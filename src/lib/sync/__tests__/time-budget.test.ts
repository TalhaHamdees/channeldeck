import { describe, expect, it, vi } from "vitest";
import { enqueueBackfill, processQueue } from "../engine";
import { withFakeGoogle, withFixedClock } from "./helpers/fake-google";
import { addChannel, channelRow, jobsFor, withTestDatabase } from "./helpers/test-db";

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

const statuses = async (channelId: string) =>
  (await jobsFor(channelId)).map((j) => j.status).sort();

describe("processQueue time budget", () => {
  it("stops claiming jobs once the default 250 s budget is used up", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A"); // 6 jobs
    google.jobDurationMs = 100_000; // each job takes about 100 s

    const startedAt = Date.now();
    const result = await processQueue("cron");

    // Jobs start at ~0 s, ~100 s and ~200 s; at ~300 s the budget is spent.
    expect(result).toEqual({ processed: 3, failed: 0, remaining: 3 });
    expect(await statuses("UC_A")).toEqual(["done", "done", "done", "pending", "pending", "pending"]);
    // The job that started before the deadline was finished, not abandoned,
    // so the run overshoots the budget by up to one job.
    expect(Date.now() - startedAt).toBeGreaterThan(250_000);
    expect(Date.now() - startedAt).toBeLessThan(300_000 + 1_000);
  });

  it("leaves unclaimed jobs untouched and the backfill marked incomplete", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A");
    google.jobDurationMs = 100_000;

    await processQueue("cron");

    const waiting = (await jobsFor("UC_A")).filter((j) => j.status === "pending");
    expect(waiting).toHaveLength(3);
    expect(waiting.every((j) => j.attempts === 0 && j.last_error === null)).toBe(true);
    expect((await channelRow("UC_A")).backfill_complete).toBe(false);
  });

  it("drains the whole queue when the budget allows", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A");
    google.jobDurationMs = 100_000;

    expect(await processQueue("cron", 1_000_000)).toEqual({
      processed: 6,
      failed: 0,
      remaining: 0,
    });
    expect((await channelRow("UC_A")).backfill_complete).toBe(true);
  });

  it("claims nothing when given no budget", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A");

    expect(await processQueue("cron", 0)).toEqual({ processed: 0, failed: 0, remaining: 6 });
    expect(google.analyticsCalls).toEqual([]);
  });

  it("a follow-up invocation picks up exactly where the last one stopped", async () => {
    await addChannel("UC_A");
    await enqueueBackfill("UC_A");
    google.jobDurationMs = 100_000;

    expect(await processQueue("cron")).toMatchObject({ processed: 3, remaining: 3 });
    expect(await processQueue("cron")).toEqual({ processed: 3, failed: 0, remaining: 0 });

    // Six planned ranges, each synced exactly once across the two invocations.
    const ranges = google.syncedRanges("UC_A").map((r) => `${r.dateFrom}..${r.dateTo}`);
    expect(ranges).toHaveLength(6);
    expect(new Set(ranges).size).toBe(6);
    expect(await statuses("UC_A")).toEqual(Array(6).fill("done"));
    expect((await channelRow("UC_A")).backfill_complete).toBe(true);
  });
});
