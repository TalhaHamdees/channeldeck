import { describe, expect, it, vi } from "vitest";
import { enqueueBackfill, enqueueDailyJobs, processQueue } from "../engine";
import { dailyWindow } from "../windows";
import { withFakeGoogle, withFixedClock, viewsOn } from "./helpers/fake-google";
import { addChannel, analyticsTables, query, queueJob, withTestDatabase } from "./helpers/test-db";

// The engine's I/O boundaries: Postgres -> in-memory PGlite, Google -> FakeGoogle.
vi.mock("@/db", async () => ({
  getDb: (await import("./helpers/test-db")).getTestDb,
  schema: await import("@/db/schema"),
}));
vi.mock("@/lib/google/oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/google/oauth")>()),
  refreshAccessToken: vi.fn(),
}));
vi.mock("@/lib/google/youtube", () => ({
  analyticsQuery: vi.fn(),
  fetchChannelStats: vi.fn(),
  fetchVideoMeta: vi.fn(),
}));

withTestDatabase();
const google = withFakeGoogle();
withFixedClock("2026-11-24T09:00:00Z");

const NIGHTLY = { channelId: "UC_A", ...dailyWindow(new Date("2026-11-24T09:00:00Z")) };

const ALL_DONE = (processed: number) => ({ processed, failed: 0, remaining: 0 });

async function storedDays(channelId: string) {
  const rows = await query<{ date: string; views: number; estimated_revenue: string }>(
    `SELECT date::text, views, estimated_revenue FROM channel_metrics_daily
     WHERE channel_id = '${channelId}'`
  );
  return new Map(
    rows.map((r) => [r.date, { views: r.views, revenue: Number(r.estimated_revenue) }])
  );
}

describe("idempotent writes", () => {
  it("running the same nightly sync twice stores exactly the same rows", async () => {
    await addChannel("UC_A");
    await queueJob(NIGHTLY);
    expect(await processQueue("cron")).toEqual(ALL_DONE(1));
    const afterFirstRun = await analyticsTables();

    await queueJob(NIGHTLY);
    expect(await processQueue("cron")).toEqual(ALL_DONE(1)); // no conflict errors
    const afterSecondRun = await analyticsTables();

    expect(afterSecondRun).toEqual(afterFirstRun);
    // ...and those rows are not empty: one per day / source / video / country.
    expect(afterFirstRun.channelMetricsDaily).toHaveLength(6);
    expect(afterFirstRun.trafficSourcesDaily).toHaveLength(6 * 2);
    expect(afterFirstRun.videos).toHaveLength(3);
    expect(afterFirstRun.videoMetricsTotals).toHaveLength(3 * 4); // 3 videos x 4 preset ranges
    expect(afterFirstRun.geographyPeriod).toHaveLength(2 * 4);
    expect(afterFirstRun.demographicsPeriod).toHaveLength(2);
  });

  it("stores the API's numbers, including revenue merged onto the same day's row", async () => {
    await addChannel("UC_A");
    await queueJob(NIGHTLY);
    await processQueue("cron");

    const [row] = await query<Record<string, unknown>>(
      "SELECT * FROM channel_metrics_daily WHERE date = '2026-11-20'"
    );
    expect(row).toMatchObject({
      views: viewsOn("2026-11-20"),
      estimated_minutes_watched: viewsOn("2026-11-20") * 3,
      subscribers_gained: 12,
      subscribers_lost: 2,
      estimated_revenue: (viewsOn("2026-11-20") / 500).toFixed(4),
      impressions: viewsOn("2026-11-20") * 10,
    });
  });

  it("the next night's window overlaps the backfill without duplicating any day", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A");
    expect(await processQueue("backfill")).toEqual(ALL_DONE(6));

    vi.setSystemTime(new Date("2026-11-25T09:00:00Z"));
    await enqueueDailyJobs();
    expect(await processQueue("cron")).toEqual(ALL_DONE(1));

    const [counts] = await query<{ rows: number; days: number }>(
      `SELECT count(*)::int AS rows, count(DISTINCT date)::int AS days
       FROM channel_metrics_daily`
    );
    // 2025-11-24 .. 2026-11-25: the year from the backfill plus one new day.
    expect(counts).toEqual({ rows: 367, days: 367 });
    const [traffic] = await query<{ rows: number }>(
      "SELECT count(*)::int AS rows FROM traffic_sources_daily"
    );
    expect(traffic.rows).toBe(367 * 2);
  });

  it("late adjustments overwrite the trailing days and leave older days alone", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A");
    await processQueue("backfill");
    const before = await storedDays("UC_A");

    // YouTube revises recent revenue (and views); the next nightly run picks it up.
    google.revenueAdjustment = 0.25;
    google.viewsAdjustment = -7;
    vi.setSystemTime(new Date("2026-11-25T09:00:00Z"));
    await enqueueDailyJobs();
    expect(await processQueue("cron")).toEqual(ALL_DONE(1));
    const after = await storedDays("UC_A");

    for (const day of ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"]) {
      expect(after.get(day)!.revenue).toBeCloseTo(before.get(day)!.revenue + 0.25, 4);
      expect(after.get(day)!.views).toBe(before.get(day)!.views - 7);
    }
    // Outside the window (2026-11-20 .. 2026-11-25): untouched.
    expect(after.get("2026-11-19")).toEqual(before.get("2026-11-19"));
    expect(after.get("2026-06-01")).toEqual(before.get("2026-06-01"));
    expect(after.size).toBe(before.size + 1); // only the new day was added
  });

  it("replaces each top-videos snapshot instead of appending to it", async () => {
    await addChannel("UC_A");
    await queueJob(NIGHTLY);
    await processQueue("cron");

    google.topVideoIds = ["vid-d", "vid-a"];
    await queueJob(NIGHTLY);
    expect(await processQueue("cron")).toEqual(ALL_DONE(1));

    const totals = await query<{ range_days: number; video_id: string }>(
      "SELECT range_days, video_id FROM video_metrics_totals ORDER BY range_days, video_id"
    );
    expect(totals).toEqual(
      [7, 28, 90, 365].flatMap((range_days) => [
        { range_days, video_id: "vid-a" },
        { range_days, video_id: "vid-d" },
      ])
    );
    // Video metadata is a cache: upserted, never deleted by a sync.
    const videos = await query<{ id: string }>("SELECT id FROM videos ORDER BY id");
    expect(videos.map((v) => v.id)).toEqual(["vid-a", "vid-b", "vid-c", "vid-d"]);
  });
});
