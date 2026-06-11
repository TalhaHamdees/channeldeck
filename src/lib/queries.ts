import { getDb, schema } from "@/db";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

export interface DateRange {
  from: string; // YYYY-MM-DD inclusive
  to: string;
}

export interface Totals {
  views: number;
  watchMinutes: number;
  subsGained: number;
  subsLost: number;
  revenue: number;
  likes: number;
  comments: number;
  impressions: number | null;
}

export interface SeriesPoint {
  date: string;
  views: number;
  watchMinutes: number;
  netSubs: number;
  revenue: number;
}

const totalsSelect = {
  views: sql<string>`coalesce(sum(${schema.channelMetricsDaily.views}), 0)`,
  watchMinutes: sql<string>`coalesce(sum(${schema.channelMetricsDaily.estimatedMinutesWatched}), 0)`,
  subsGained: sql<string>`coalesce(sum(${schema.channelMetricsDaily.subscribersGained}), 0)`,
  subsLost: sql<string>`coalesce(sum(${schema.channelMetricsDaily.subscribersLost}), 0)`,
  revenue: sql<string>`coalesce(sum(${schema.channelMetricsDaily.estimatedRevenue}), 0)`,
  likes: sql<string>`coalesce(sum(${schema.channelMetricsDaily.likes}), 0)`,
  comments: sql<string>`coalesce(sum(${schema.channelMetricsDaily.comments}), 0)`,
  impressions: sql<string | null>`sum(${schema.channelMetricsDaily.impressions})`,
};

function toTotals(row: Record<string, string | null>): Totals {
  return {
    views: Number(row.views ?? 0),
    watchMinutes: Number(row.watchMinutes ?? 0),
    subsGained: Number(row.subsGained ?? 0),
    subsLost: Number(row.subsLost ?? 0),
    revenue: Number(row.revenue ?? 0),
    likes: Number(row.likes ?? 0),
    comments: Number(row.comments ?? 0),
    impressions: row.impressions === null ? null : Number(row.impressions),
  };
}

function rangeFilter(range: DateRange, channelId?: string) {
  const conds = [
    gte(schema.channelMetricsDaily.date, range.from),
    lte(schema.channelMetricsDaily.date, range.to),
  ];
  if (channelId) conds.push(eq(schema.channelMetricsDaily.channelId, channelId));
  return and(...conds);
}

export async function getTotals(
  range: DateRange,
  channelId?: string
): Promise<Totals> {
  const db = getDb();
  const [row] = await db
    .select(totalsSelect)
    .from(schema.channelMetricsDaily)
    .where(rangeFilter(range, channelId));
  return toTotals(row ?? {});
}

export async function getSeries(
  range: DateRange,
  channelId?: string
): Promise<SeriesPoint[]> {
  const db = getDb();
  const rows = await db
    .select({
      date: schema.channelMetricsDaily.date,
      views: totalsSelect.views,
      watchMinutes: totalsSelect.watchMinutes,
      subsGained: totalsSelect.subsGained,
      subsLost: totalsSelect.subsLost,
      revenue: totalsSelect.revenue,
    })
    .from(schema.channelMetricsDaily)
    .where(rangeFilter(range, channelId))
    .groupBy(schema.channelMetricsDaily.date)
    .orderBy(schema.channelMetricsDaily.date);

  return rows.map((r) => ({
    date: r.date,
    views: Number(r.views),
    watchMinutes: Number(r.watchMinutes),
    netSubs: Number(r.subsGained) - Number(r.subsLost),
    revenue: Number(r.revenue),
  }));
}

export interface ChannelSummary {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  tokenStatus: string;
  subscriberCount: number | null;
  backfillComplete: boolean;
  lastSyncedAt: Date | null;
  totals: Totals;
  sparkline: Array<{ date: string; views: number }>;
}

export async function getChannelSummaries(
  range: DateRange
): Promise<ChannelSummary[]> {
  const db = getDb();
  const channels = await db
    .select()
    .from(schema.channels)
    .orderBy(schema.channels.sortOrder, schema.channels.title);

  const totalsRows = await db
    .select({
      channelId: schema.channelMetricsDaily.channelId,
      ...totalsSelect,
    })
    .from(schema.channelMetricsDaily)
    .where(rangeFilter(range))
    .groupBy(schema.channelMetricsDaily.channelId);

  const sparkRows = await db
    .select({
      channelId: schema.channelMetricsDaily.channelId,
      date: schema.channelMetricsDaily.date,
      views: schema.channelMetricsDaily.views,
    })
    .from(schema.channelMetricsDaily)
    .where(rangeFilter(range))
    .orderBy(schema.channelMetricsDaily.date);

  const totalsByChannel = new Map(
    totalsRows.map((r) => [r.channelId, toTotals(r)])
  );
  const sparkByChannel = new Map<string, Array<{ date: string; views: number }>>();
  for (const r of sparkRows) {
    const arr = sparkByChannel.get(r.channelId) ?? [];
    arr.push({ date: r.date, views: Number(r.views) });
    sparkByChannel.set(r.channelId, arr);
  }

  const empty: Totals = {
    views: 0,
    watchMinutes: 0,
    subsGained: 0,
    subsLost: 0,
    revenue: 0,
    likes: 0,
    comments: 0,
    impressions: null,
  };

  return channels.map((c) => ({
    id: c.id,
    title: c.title,
    thumbnailUrl: c.thumbnailUrl,
    tokenStatus: c.tokenStatus,
    subscriberCount: c.subscriberCount,
    backfillComplete: c.backfillComplete,
    lastSyncedAt: c.lastSyncedAt,
    totals: totalsByChannel.get(c.id) ?? empty,
    sparkline: sparkByChannel.get(c.id) ?? [],
  }));
}

/** Latest date with finalized (non-null) revenue — the "data through" badge. */
export async function getDataThroughDate(
  channelId?: string
): Promise<string | null> {
  const db = getDb();
  const conds = [sql`${schema.channelMetricsDaily.estimatedRevenue} IS NOT NULL`];
  if (channelId) conds.push(eq(schema.channelMetricsDaily.channelId, channelId));
  const [row] = await db
    .select({ d: sql<string | null>`max(${schema.channelMetricsDaily.date})` })
    .from(schema.channelMetricsDaily)
    .where(and(...conds));
  return row?.d ?? null;
}

export async function getTopVideos(channelId: string, rangeDays: number) {
  const db = getDb();
  return db
    .select({
      videoId: schema.videoMetricsTotals.videoId,
      title: schema.videos.title,
      thumbnailUrl: schema.videos.thumbnailUrl,
      publishedAt: schema.videos.publishedAt,
      views: schema.videoMetricsTotals.views,
      watchMinutes: schema.videoMetricsTotals.estimatedMinutesWatched,
      avgViewDurationSecs: schema.videoMetricsTotals.averageViewDurationSecs,
      revenue: schema.videoMetricsTotals.estimatedRevenue,
    })
    .from(schema.videoMetricsTotals)
    .innerJoin(
      schema.videos,
      eq(schema.videos.id, schema.videoMetricsTotals.videoId)
    )
    .where(
      and(
        eq(schema.videoMetricsTotals.channelId, channelId),
        eq(schema.videoMetricsTotals.rangeDays, rangeDays)
      )
    )
    .orderBy(desc(schema.videoMetricsTotals.views))
    .limit(25);
}

export async function getTrafficSources(range: DateRange, channelId: string) {
  const db = getDb();
  const rows = await db
    .select({
      sourceType: schema.trafficSourcesDaily.sourceType,
      views: sql<string>`coalesce(sum(${schema.trafficSourcesDaily.views}), 0)`,
    })
    .from(schema.trafficSourcesDaily)
    .where(
      and(
        eq(schema.trafficSourcesDaily.channelId, channelId),
        gte(schema.trafficSourcesDaily.date, range.from),
        lte(schema.trafficSourcesDaily.date, range.to)
      )
    )
    .groupBy(schema.trafficSourcesDaily.sourceType)
    .orderBy(desc(sql`sum(${schema.trafficSourcesDaily.views})`));
  return rows.map((r) => ({ sourceType: r.sourceType, views: Number(r.views) }));
}

export async function getGeography(channelId: string, rangeDays: number) {
  const db = getDb();
  return db
    .select()
    .from(schema.geographyPeriod)
    .where(
      and(
        eq(schema.geographyPeriod.channelId, channelId),
        eq(schema.geographyPeriod.rangeDays, rangeDays)
      )
    )
    .orderBy(desc(schema.geographyPeriod.views))
    .limit(10);
}

export async function getDemographics(channelId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.demographicsPeriod)
    .where(eq(schema.demographicsPeriod.channelId, channelId))
    .orderBy(schema.demographicsPeriod.ageGroup);
}

export async function getRecentSyncRuns(limit = 10) {
  const db = getDb();
  const runs = await db
    .select()
    .from(schema.syncRuns)
    .orderBy(desc(schema.syncRuns.startedAt))
    .limit(limit);

  if (runs.length === 0) return [];

  const details = await db
    .select({
      syncRunId: schema.syncRunChannels.syncRunId,
      channelId: schema.syncRunChannels.channelId,
      channelTitle: schema.channels.title,
      status: schema.syncRunChannels.status,
      errorMessage: schema.syncRunChannels.errorMessage,
      rowsUpserted: schema.syncRunChannels.rowsUpserted,
      dateFrom: schema.syncRunChannels.dateFrom,
      dateTo: schema.syncRunChannels.dateTo,
    })
    .from(schema.syncRunChannels)
    .innerJoin(
      schema.channels,
      eq(schema.channels.id, schema.syncRunChannels.channelId)
    )
    .where(
      sql`${schema.syncRunChannels.syncRunId} IN ${sql.raw(
        `(${runs.map((r) => `'${r.id}'`).join(",")})`
      )}`
    );

  return runs.map((run) => ({
    ...run,
    channels: details.filter((d) => d.syncRunId === run.id),
  }));
}

export async function getPendingJobCount(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<string>`count(*)` })
    .from(schema.syncJobs)
    .where(eq(schema.syncJobs.status, "pending"));
  return Number(row?.n ?? 0);
}
