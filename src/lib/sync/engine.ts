import { getDb, schema } from "@/db";
import { decryptToken } from "@/lib/crypto";
import { InvalidGrantError, refreshAccessToken } from "@/lib/google/oauth";
import {
  analyticsQuery,
  fetchChannelStats,
  fetchVideoMeta,
} from "@/lib/google/youtube";
import { and, eq, sql } from "drizzle-orm";
import type { Channel, SyncJob } from "@/db/schema";

const BACKFILL_DAYS = 365;
const CHUNK_DAYS = 90;
const DAILY_OVERLAP_DAYS = 5; // re-pull window so lagging revenue self-corrects
export const PRESET_RANGES = [7, 28, 90, 365] as const;
const TOP_VIDEOS_PER_RANGE = 25;

// ---------- date helpers (YYYY-MM-DD, UTC) ----------

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return toDateStr(d);
}

// ---------- queue management ----------

export async function enqueueBackfill(channelId: string): Promise<void> {
  const db = getDb();
  // Clear any stale jobs for this channel, then queue fresh chunks.
  await db
    .delete(schema.syncJobs)
    .where(eq(schema.syncJobs.channelId, channelId));

  const jobs = [];
  for (let offset = 0; offset < BACKFILL_DAYS; offset += CHUNK_DAYS) {
    const to = daysAgo(offset);
    const from = daysAgo(Math.min(offset + CHUNK_DAYS - 1, BACKFILL_DAYS));
    jobs.push({
      channelId,
      jobType: "backfill_chunk" as const,
      dateFrom: from,
      dateTo: to,
    });
  }
  // Also one "daily" job so snapshots (top videos, geo, demographics)
  // populate immediately after connect.
  jobs.push({
    channelId,
    jobType: "daily" as const,
    dateFrom: daysAgo(DAILY_OVERLAP_DAYS),
    dateTo: daysAgo(0),
  });
  await db.insert(schema.syncJobs).values(jobs);
}

export async function enqueueDailyJobs(): Promise<number> {
  const db = getDb();
  const active = await db
    .select({ id: schema.channels.id })
    .from(schema.channels)
    .where(eq(schema.channels.tokenStatus, "active"));

  let queued = 0;
  for (const ch of active) {
    const pending = await db
      .select({ id: schema.syncJobs.id })
      .from(schema.syncJobs)
      .where(
        and(
          eq(schema.syncJobs.channelId, ch.id),
          eq(schema.syncJobs.jobType, "daily"),
          eq(schema.syncJobs.status, "pending")
        )
      )
      .limit(1);
    if (pending.length > 0) continue;
    await db.insert(schema.syncJobs).values({
      channelId: ch.id,
      jobType: "daily",
      dateFrom: daysAgo(DAILY_OVERLAP_DAYS),
      dateTo: daysAgo(0),
    });
    queued++;
  }
  return queued;
}

/** Atomically claim the oldest pending job (safe across concurrent runners). */
async function claimNextJob(): Promise<SyncJob | null> {
  const db = getDb();
  const result = await db.execute(sql`
    UPDATE sync_jobs
    SET status = 'running', attempts = attempts + 1
    WHERE id = (
      SELECT id FROM sync_jobs
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT 1
    )
    AND status = 'pending'
    RETURNING id, channel_id AS "channelId", job_type AS "jobType",
              date_from AS "dateFrom", date_to AS "dateTo",
              status, attempts, last_error AS "lastError",
              created_at AS "createdAt"
  `);
  const rows = result.rows as unknown as SyncJob[];
  return rows[0] ?? null;
}

// ---------- the queue processor ----------

export interface ProcessResult {
  processed: number;
  failed: number;
  remaining: number;
}

export async function processQueue(
  trigger: "cron" | "manual" | "backfill",
  deadlineMs = 250_000
): Promise<ProcessResult> {
  const db = getDb();
  const deadline = Date.now() + deadlineMs;
  let processed = 0;
  let failed = 0;

  const [run] = await db
    .insert(schema.syncRuns)
    .values({ trigger })
    .returning();

  // Access tokens are cached per channel for the life of this invocation.
  const tokenCache = new Map<string, string>();

  while (Date.now() < deadline) {
    const job = await claimNextJob();
    if (!job) break;

    const [channel] = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.id, job.channelId));

    if (!channel || channel.tokenStatus !== "active") {
      await db
        .update(schema.syncJobs)
        .set({ status: "failed", lastError: "channel missing or token not active" })
        .where(eq(schema.syncJobs.id, job.id));
      failed++;
      continue;
    }

    try {
      let accessToken = tokenCache.get(channel.id);
      if (!accessToken) {
        accessToken = await refreshAccessToken(
          decryptToken(channel.refreshTokenEnc)
        );
        tokenCache.set(channel.id, accessToken);
      }

      let rows = await syncChannelRange(
        channel,
        accessToken,
        job.dateFrom,
        job.dateTo
      );
      if (job.jobType === "daily") {
        rows += await syncChannelSnapshots(channel, accessToken);
      }

      await db
        .update(schema.syncJobs)
        .set({ status: "done", lastError: null })
        .where(eq(schema.syncJobs.id, job.id));
      await db.insert(schema.syncRunChannels).values({
        syncRunId: run.id,
        channelId: channel.id,
        status: "success",
        rowsUpserted: rows,
        dateFrom: job.dateFrom,
        dateTo: job.dateTo,
      });
      await db
        .update(schema.channels)
        .set({ lastSyncedAt: new Date() })
        .where(eq(schema.channels.id, channel.id));
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (err instanceof InvalidGrantError) {
        // Token revoked — flag the channel, fail the job, keep going.
        await db
          .update(schema.channels)
          .set({ tokenStatus: "revoked" })
          .where(eq(schema.channels.id, channel.id));
        await db
          .update(schema.syncJobs)
          .set({ status: "failed", lastError: "invalid_grant (reconnect needed)" })
          .where(eq(schema.syncJobs.id, job.id));
        tokenCache.delete(channel.id);
      } else {
        // Transient (5xx / rate limit): retry up to 3 attempts.
        await db
          .update(schema.syncJobs)
          .set({
            status: job.attempts >= 3 ? "failed" : "pending",
            lastError: message.slice(0, 2000),
          })
          .where(eq(schema.syncJobs.id, job.id));
      }

      await db.insert(schema.syncRunChannels).values({
        syncRunId: run.id,
        channelId: channel.id,
        status: "failed",
        errorMessage: message.slice(0, 2000),
        dateFrom: job.dateFrom,
        dateTo: job.dateTo,
      });
      failed++;
    }
  }

  // Mark channels whose backfill queue has fully drained.
  await db.execute(sql`
    UPDATE channels SET backfill_complete = true
    WHERE backfill_complete = false
      AND NOT EXISTS (
        SELECT 1 FROM sync_jobs
        WHERE sync_jobs.channel_id = channels.id
          AND sync_jobs.job_type = 'backfill_chunk'
          AND sync_jobs.status IN ('pending', 'running')
      )
  `);

  const remainingRes = await db.execute(
    sql`SELECT count(*)::int AS n FROM sync_jobs WHERE status = 'pending'`
  );
  const remaining = (remainingRes.rows[0] as { n: number }).n;

  await db
    .update(schema.syncRuns)
    .set({
      finishedAt: new Date(),
      status:
        failed === 0 ? "success" : processed > 0 ? "partial" : "failed",
    })
    .where(eq(schema.syncRuns.id, run.id));

  return { processed, failed, remaining };
}

// ---------- per-channel sync ----------

/**
 * Daily time-series for [from, to]: core metrics + revenue + (best-effort)
 * thumbnail impressions, plus traffic sources. Idempotent upserts throughout.
 */
async function syncChannelRange(
  channel: Channel,
  accessToken: string,
  from: string,
  to: string
): Promise<number> {
  const db = getDb();
  let rows = 0;

  // 1) Core daily metrics.
  const core = await analyticsQuery(accessToken, channel.id, {
    startDate: from,
    endDate: to,
    dimensions: ["day"],
    metrics: [
      "views",
      "estimatedMinutesWatched",
      "averageViewDuration",
      "subscribersGained",
      "subscribersLost",
      "likes",
      "comments",
      "shares",
    ],
  });

  for (const r of core) {
    await db
      .insert(schema.channelMetricsDaily)
      .values({
        channelId: channel.id,
        date: String(r.day),
        views: Number(r.views ?? 0),
        estimatedMinutesWatched: Number(r.estimatedMinutesWatched ?? 0),
        averageViewDurationSecs: Number(r.averageViewDuration ?? 0),
        subscribersGained: Number(r.subscribersGained ?? 0),
        subscribersLost: Number(r.subscribersLost ?? 0),
        likes: Number(r.likes ?? 0),
        comments: Number(r.comments ?? 0),
        shares: Number(r.shares ?? 0),
      })
      .onConflictDoUpdate({
        target: [
          schema.channelMetricsDaily.channelId,
          schema.channelMetricsDaily.date,
        ],
        set: {
          views: Number(r.views ?? 0),
          estimatedMinutesWatched: Number(r.estimatedMinutesWatched ?? 0),
          averageViewDurationSecs: Number(r.averageViewDuration ?? 0),
          subscribersGained: Number(r.subscribersGained ?? 0),
          subscribersLost: Number(r.subscribersLost ?? 0),
          likes: Number(r.likes ?? 0),
          comments: Number(r.comments ?? 0),
          shares: Number(r.shares ?? 0),
        },
      });
    rows++;
  }

  // 2) Revenue metrics (separate query — can't always combine with core).
  //    Tolerated failure: channel temporarily lacking monetary data.
  try {
    const revenue = await analyticsQuery(accessToken, channel.id, {
      startDate: from,
      endDate: to,
      dimensions: ["day"],
      metrics: ["estimatedRevenue", "monetizedPlaybacks", "playbackBasedCpm"],
    });
    for (const r of revenue) {
      await db
        .update(schema.channelMetricsDaily)
        .set({
          estimatedRevenue: String(r.estimatedRevenue ?? 0),
          monetizedPlaybacks: Number(r.monetizedPlaybacks ?? 0),
          playbackBasedCpm: String(r.playbackBasedCpm ?? 0),
        })
        .where(
          and(
            eq(schema.channelMetricsDaily.channelId, channel.id),
            eq(schema.channelMetricsDaily.date, String(r.day))
          )
        );
      rows++;
    }
  } catch (err) {
    if (err instanceof InvalidGrantError) throw err;
    console.warn(`Revenue query failed for ${channel.id}:`, err);
  }

  // 3) Thumbnail impressions — added to Google's API in Jan 2026; support in
  //    the targeted-query endpoint is uncertain, so this is best-effort.
  try {
    const impressions = await analyticsQuery(accessToken, channel.id, {
      startDate: from,
      endDate: to,
      dimensions: ["day"],
      metrics: [
        "videoThumbnailImpressions",
        "videoThumbnailImpressionsClickRate",
      ],
    });
    for (const r of impressions) {
      await db
        .update(schema.channelMetricsDaily)
        .set({
          impressions: Number(r.videoThumbnailImpressions ?? 0),
          impressionsCtr: String(
            r.videoThumbnailImpressionsClickRate ?? 0
          ),
        })
        .where(
          and(
            eq(schema.channelMetricsDaily.channelId, channel.id),
            eq(schema.channelMetricsDaily.date, String(r.day))
          )
        );
    }
  } catch (err) {
    if (err instanceof InvalidGrantError) throw err;
    // Metric not supported — dashboard shows "—" for impressions.
  }

  // 4) Traffic sources, in ≤31-day slices to stay under response row limits.
  let sliceStart = new Date(`${from}T00:00:00Z`);
  const rangeEnd = new Date(`${to}T00:00:00Z`);
  while (sliceStart <= rangeEnd) {
    const sliceEnd = new Date(sliceStart);
    sliceEnd.setUTCDate(sliceEnd.getUTCDate() + 30);
    const sFrom = toDateStr(sliceStart);
    const sTo = toDateStr(sliceEnd > rangeEnd ? rangeEnd : sliceEnd);

    const traffic = await analyticsQuery(accessToken, channel.id, {
      startDate: sFrom,
      endDate: sTo,
      dimensions: ["day", "insightTrafficSourceType"],
      metrics: ["views", "estimatedMinutesWatched"],
    });
    for (const r of traffic) {
      await db
        .insert(schema.trafficSourcesDaily)
        .values({
          channelId: channel.id,
          date: String(r.day),
          sourceType: String(r.insightTrafficSourceType),
          views: Number(r.views ?? 0),
          estimatedMinutesWatched: Number(r.estimatedMinutesWatched ?? 0),
        })
        .onConflictDoUpdate({
          target: [
            schema.trafficSourcesDaily.channelId,
            schema.trafficSourcesDaily.date,
            schema.trafficSourcesDaily.sourceType,
          ],
          set: {
            views: Number(r.views ?? 0),
            estimatedMinutesWatched: Number(r.estimatedMinutesWatched ?? 0),
          },
        });
      rows++;
    }
    sliceStart = new Date(sliceEnd);
    sliceStart.setUTCDate(sliceStart.getUTCDate() + 1);
  }

  return rows;
}

/**
 * Range-snapshot data refreshed on every daily sync: top videos per preset
 * range, geography per preset range, rolling-28d demographics, lifetime
 * channel stats. Replaces prior snapshots (delete + insert / upsert).
 */
async function syncChannelSnapshots(
  channel: Channel,
  accessToken: string
): Promise<number> {
  const db = getDb();
  let rows = 0;
  const today = daysAgo(0);

  // Lifetime stats for the header cards (subscriber count is lifetime-only).
  const stats = await fetchChannelStats(accessToken, channel.id);
  if (stats) {
    await db
      .update(schema.channels)
      .set({
        subscriberCount: stats.subscriberCount,
        videoCount: stats.videoCount,
        totalViewCount: stats.viewCount,
      })
      .where(eq(schema.channels.id, channel.id));
  }

  for (const rangeDays of PRESET_RANGES) {
    const from = daysAgo(rangeDays);

    // --- Top videos for this range ---
    let top: Array<Record<string, string | number>> = [];
    try {
      top = await analyticsQuery(accessToken, channel.id, {
        startDate: from,
        endDate: today,
        dimensions: ["video"],
        metrics: ["views", "estimatedMinutesWatched", "averageViewDuration"],
        sort: "-views",
        maxResults: TOP_VIDEOS_PER_RANGE,
      });
    } catch (err) {
      if (err instanceof InvalidGrantError) throw err;
      console.warn(`Top videos query failed for ${channel.id}:`, err);
    }

    if (top.length > 0) {
      const ids = top.map((r) => String(r.video));

      // Per-video revenue for the same range (best-effort).
      const revenueByVideo = new Map<string, number>();
      try {
        const rev = await analyticsQuery(accessToken, channel.id, {
          startDate: from,
          endDate: today,
          dimensions: ["video"],
          metrics: ["estimatedRevenue"],
          filters: `video==${ids.join(",")}`,
          sort: "-estimatedRevenue",
          maxResults: TOP_VIDEOS_PER_RANGE,
        });
        for (const r of rev) {
          revenueByVideo.set(String(r.video), Number(r.estimatedRevenue ?? 0));
        }
      } catch (err) {
        if (err instanceof InvalidGrantError) throw err;
      }

      // Hydrate titles/thumbnails for any videos we haven't seen.
      const meta = await fetchVideoMeta(accessToken, ids);
      for (const m of meta) {
        await db
          .insert(schema.videos)
          .values({
            id: m.id,
            channelId: channel.id,
            title: m.title,
            thumbnailUrl: m.thumbnailUrl,
            durationSecs: m.durationSecs,
            publishedAt: new Date(m.publishedAt),
          })
          .onConflictDoUpdate({
            target: schema.videos.id,
            set: { title: m.title, thumbnailUrl: m.thumbnailUrl },
          });
      }

      // Replace this range's snapshot for the channel.
      await db
        .delete(schema.videoMetricsTotals)
        .where(
          and(
            eq(schema.videoMetricsTotals.channelId, channel.id),
            eq(schema.videoMetricsTotals.rangeDays, rangeDays)
          )
        );
      const knownIds = new Set(meta.map((m) => m.id));
      for (const r of top) {
        const vid = String(r.video);
        if (!knownIds.has(vid)) continue; // deleted/private video
        await db.insert(schema.videoMetricsTotals).values({
          videoId: vid,
          channelId: channel.id,
          rangeDays,
          rangeStart: from,
          rangeEnd: today,
          views: Number(r.views ?? 0),
          estimatedMinutesWatched: Number(r.estimatedMinutesWatched ?? 0),
          averageViewDurationSecs: Number(r.averageViewDuration ?? 0),
          estimatedRevenue:
            revenueByVideo.get(vid) !== undefined
              ? String(revenueByVideo.get(vid))
              : null,
        });
        rows++;
      }
    }

    // --- Geography for this range ---
    try {
      const geo = await analyticsQuery(accessToken, channel.id, {
        startDate: from,
        endDate: today,
        dimensions: ["country"],
        metrics: ["views", "estimatedMinutesWatched", "estimatedRevenue"],
        sort: "-views",
        maxResults: 50,
      });
      await db
        .delete(schema.geographyPeriod)
        .where(
          and(
            eq(schema.geographyPeriod.channelId, channel.id),
            eq(schema.geographyPeriod.rangeDays, rangeDays)
          )
        );
      for (const r of geo) {
        await db.insert(schema.geographyPeriod).values({
          channelId: channel.id,
          periodStart: from,
          periodEnd: today,
          rangeDays,
          country: String(r.country),
          views: Number(r.views ?? 0),
          estimatedMinutesWatched: Number(r.estimatedMinutesWatched ?? 0),
          estimatedRevenue: String(r.estimatedRevenue ?? 0),
        });
        rows++;
      }
    } catch (err) {
      if (err instanceof InvalidGrantError) throw err;
      console.warn(`Geography query failed for ${channel.id}:`, err);
    }
  }

  // --- Demographics, rolling 28 days ---
  try {
    const demo = await analyticsQuery(accessToken, channel.id, {
      startDate: daysAgo(28),
      endDate: today,
      dimensions: ["ageGroup", "gender"],
      metrics: ["viewerPercentage"],
    });
    if (demo.length > 0) {
      await db
        .delete(schema.demographicsPeriod)
        .where(eq(schema.demographicsPeriod.channelId, channel.id));
      for (const r of demo) {
        await db.insert(schema.demographicsPeriod).values({
          channelId: channel.id,
          periodStart: daysAgo(28),
          periodEnd: today,
          ageGroup: String(r.ageGroup),
          gender: String(r.gender),
          viewerPercentage: String(r.viewerPercentage ?? 0),
        });
        rows++;
      }
    }
  } catch (err) {
    if (err instanceof InvalidGrantError) throw err;
    console.warn(`Demographics query failed for ${channel.id}:`, err);
  }

  return rows;
}
