import { describe, expect, it, vi } from "vitest";
import { enqueueBackfill, enqueueDailyJobs, processQueue } from "../engine";
import { eachDay } from "./helpers/days";
import { withFakeGoogle, withFixedClock } from "./helpers/fake-google";
import {
  addChannel,
  channelRow,
  jobsFor,
  query,
  queueJob,
  withTestDatabase,
} from "./helpers/test-db";

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

const PLANNED_RANGES = [
  ["backfill_chunk", "2026-08-27", "2026-11-24"],
  ["backfill_chunk", "2026-05-29", "2026-08-26"],
  ["backfill_chunk", "2026-02-28", "2026-05-28"],
  ["backfill_chunk", "2025-11-30", "2026-02-27"],
  ["backfill_chunk", "2025-11-24", "2025-11-29"],
  ["daily", "2026-11-19", "2026-11-24"],
];

describe("enqueueBackfill", () => {
  it("queues the last year as 90-day chunks plus one daily job", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A");

    const jobs = await jobsFor("UC_A");
    expect(jobs.map((j) => [j.job_type, j.date_from, j.date_to])).toEqual(PLANNED_RANGES);
    expect(jobs.every((j) => j.status === "pending" && j.attempts === 0)).toBe(true);
  });

  it("replaces the channel's stale jobs and leaves other channels' jobs alone", async () => {
    await addChannel("UC_A");
    await addChannel("UC_B");
    await queueJob({ channelId: "UC_A", dateFrom: "2026-01-01", dateTo: "2026-01-05" });
    await queueJob({ channelId: "UC_B", dateFrom: "2026-01-01", dateTo: "2026-01-05" });

    await enqueueBackfill("UC_A");

    expect(await jobsFor("UC_A")).toHaveLength(PLANNED_RANGES.length);
    expect(await jobsFor("UC_B")).toMatchObject([
      { date_from: "2026-01-01", date_to: "2026-01-05", status: "pending" },
    ]);
  });
});

describe("enqueueDailyJobs", () => {
  it("queues one nightly re-pull per active channel and skips revoked ones", async () => {
    await addChannel("UC_A");
    await addChannel("UC_B");
    await addChannel("UC_REVOKED", "revoked");

    expect(await enqueueDailyJobs()).toBe(2);

    for (const id of ["UC_A", "UC_B"]) {
      expect(await jobsFor(id)).toMatchObject([
        { job_type: "daily", date_from: "2026-11-19", date_to: "2026-11-24", status: "pending" },
      ]);
    }
    expect(await jobsFor("UC_REVOKED")).toEqual([]);
  });

  it("does not queue a second job while one is still waiting", async () => {
    await addChannel("UC_A");

    expect(await enqueueDailyJobs()).toBe(1);
    expect(await enqueueDailyJobs()).toBe(0);
    expect(await jobsFor("UC_A")).toHaveLength(1);

    // Once that job has run, the next night queues a fresh one.
    await processQueue("cron");
    expect(await enqueueDailyJobs()).toBe(1);
  });
});

describe("processQueue draining a new channel's backfill", () => {
  it("syncs every planned range once and stores every day of the year", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A");

    const result = await processQueue("backfill");

    expect(result).toEqual({ processed: 6, failed: 0, remaining: 0 });
    expect(google.syncedRanges("UC_A")).toEqual(
      expect.arrayContaining(PLANNED_RANGES.map(([, dateFrom, dateTo]) => ({ dateFrom, dateTo })))
    );
    expect(google.syncedRanges("UC_A")).toHaveLength(PLANNED_RANGES.length);

    const stored = await query<{ date: string }>(
      "SELECT date::text FROM channel_metrics_daily WHERE channel_id = 'UC_A' ORDER BY date"
    );
    expect(stored.map((r) => r.date)).toEqual(eachDay("2025-11-24", "2026-11-24"));
  });

  it("marks the jobs done, the channel synced and the backfill complete", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A");
    expect((await channelRow("UC_A")).backfill_complete).toBe(false);

    await processQueue("backfill");

    expect((await jobsFor("UC_A")).every((j) => j.status === "done")).toBe(true);
    const channel = await channelRow("UC_A");
    expect(channel.backfill_complete).toBe(true);
    expect(channel.last_synced_at).not.toBeNull();

    const [run] = await query<{ trigger: string; status: string; finished_at: Date | null }>(
      "SELECT * FROM sync_runs"
    );
    expect(run).toMatchObject({ trigger: "backfill", status: "success" });
    expect(run.finished_at).not.toBeNull();
    const perJob = await query<{ status: string }>("SELECT status FROM sync_run_channels");
    expect(perJob).toHaveLength(6);
    expect(perJob.every((r) => r.status === "success")).toBe(true);
  });

  it("refreshes each channel's access token once per run, not once per job", async () => {
    await addChannel("UC_A");
    await addChannel("UC_B");
    await enqueueBackfill("UC_A");
    await enqueueBackfill("UC_B");

    await processQueue("backfill");

    expect(google.refreshCalls.sort()).toEqual(["UC_A", "UC_B"]);
  });
});
