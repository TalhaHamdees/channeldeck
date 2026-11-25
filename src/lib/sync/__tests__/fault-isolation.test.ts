import { describe, expect, it, vi } from "vitest";
import { InvalidGrantError } from "@/lib/google/oauth";
import { processQueue } from "../engine";
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

const WINDOW = { dateFrom: "2026-11-19", dateTo: "2026-11-24" };

/**
 * Two channels, each with one nightly job. The failing channel's job is queued
 * first, so the healthy channel is only reached if the failure was contained.
 */
async function twoChannelsFailingFirst() {
  await addChannel("UC_BAD");
  await addChannel("UC_OK");
  await queueJob({ channelId: "UC_BAD", ...WINDOW, createdAt: new Date("2026-11-24T08:59:00Z") });
  await queueJob({ channelId: "UC_OK", ...WINDOW, createdAt: new Date("2026-11-24T08:59:01Z") });
}

async function expectHealthyChannelSynced() {
  expect(await jobsFor("UC_OK")).toMatchObject([{ status: "done" }]);
  const channel = await channelRow("UC_OK");
  expect(channel.token_status).toBe("active");
  expect(channel.last_synced_at).not.toBeNull();
  const [{ n }] = await query<{ n: number }>(
    "SELECT count(*)::int AS n FROM channel_metrics_daily WHERE channel_id = 'UC_OK'"
  );
  expect(n).toBe(6);
}

async function runStatus() {
  const [run] = await query<{ status: string }>("SELECT status FROM sync_runs");
  return run.status;
}

describe("per-channel fault isolation", () => {
  it("a revoked refresh token flags that channel and the others still sync", async () => {
    await twoChannelsFailingFirst();
    google.revokedTokens.add("UC_BAD");

    const result = await processQueue("cron");

    expect(result).toEqual({ processed: 1, failed: 1, remaining: 0 });
    expect((await channelRow("UC_BAD")).token_status).toBe("revoked");
    expect(await jobsFor("UC_BAD")).toMatchObject([
      { status: "failed", last_error: "invalid_grant (reconnect needed)" },
    ]);
    await expectHealthyChannelSynced();
    expect(await runStatus()).toBe("partial");

    const log = await query<{ channel_id: string; status: string }>(
      "SELECT channel_id, status FROM sync_run_channels ORDER BY channel_id"
    );
    expect(log).toEqual([
      { channel_id: "UC_BAD", status: "failed" },
      { channel_id: "UC_OK", status: "success" },
    ]);
  });

  it("a 401 from the Analytics API mid-sync is treated as a revoked token", async () => {
    await twoChannelsFailingFirst();
    google.failingChannels.set("UC_BAD", new InvalidGrantError("401 Unauthorized"));

    expect(await processQueue("cron")).toEqual({ processed: 1, failed: 1, remaining: 0 });
    expect((await channelRow("UC_BAD")).token_status).toBe("revoked");
    await expectHealthyChannelSynced();
  });

  it("the best-effort revenue query does not swallow auth errors", async () => {
    await addChannel("UC_BAD");
    // A backfill chunk skips the snapshot queries, so the daily revenue query
    // is the only one that asks for estimatedRevenue.
    await queueJob({ channelId: "UC_BAD", jobType: "backfill_chunk", ...WINDOW });
    google.failingMetrics.set("estimatedRevenue", new InvalidGrantError());

    expect(await processQueue("cron")).toEqual({ processed: 0, failed: 1, remaining: 0 });
    expect((await channelRow("UC_BAD")).token_status).toBe("revoked");
  });

  it("the channel's remaining jobs fail fast, without calling Google again", async () => {
    await twoChannelsFailingFirst();
    await queueJob({
      channelId: "UC_BAD",
      jobType: "backfill_chunk",
      dateFrom: "2026-08-27",
      dateTo: "2026-11-24",
      createdAt: new Date("2026-11-24T08:59:00.500Z"),
    });
    google.revokedTokens.add("UC_BAD");

    expect(await processQueue("cron")).toEqual({ processed: 1, failed: 2, remaining: 0 });
    expect(google.refreshCalls.filter((id) => id === "UC_BAD")).toHaveLength(1);
    expect((await jobsFor("UC_BAD")).map((j) => j.last_error).sort()).toEqual([
      "channel missing or token not active",
      "invalid_grant (reconnect needed)",
    ]);
    await expectHealthyChannelSynced();
  });

  it("jobs for a channel already flagged as revoked are failed without any API call", async () => {
    await addChannel("UC_BAD", "revoked");
    await queueJob({ channelId: "UC_BAD", ...WINDOW });

    expect(await processQueue("cron")).toEqual({ processed: 0, failed: 1, remaining: 0 });
    expect(google.refreshCalls).toEqual([]);
    expect(await runStatus()).toBe("failed");
  });

  it("a transient API error is retried up to 3 attempts, then the job fails and the token stays active", async () => {
    await twoChannelsFailingFirst();
    google.failingChannels.set("UC_BAD", new Error("Google API error (500): backendError"));

    const result = await processQueue("cron");

    // The retries happen back to back within this run (the failed job is
    // re-queued as the oldest pending job), each counted as a failure.
    expect(result).toEqual({ processed: 1, failed: 3, remaining: 0 });
    expect(await jobsFor("UC_BAD")).toMatchObject([
      { status: "failed", attempts: 3, last_error: "Google API error (500): backendError" },
    ]);
    expect((await channelRow("UC_BAD")).token_status).toBe("active");
    await expectHealthyChannelSynced();
  });

  it("a failing revenue or impressions query is tolerated: the job succeeds without them", async () => {
    await addChannel("UC_A");
    await queueJob({ channelId: "UC_A", ...WINDOW });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    google.failingMetrics.set("estimatedRevenue", new Error("Google API forbidden (403)"));
    google.failingMetrics.set(
      "videoThumbnailImpressions",
      new Error("Google API error (400): unknown metric")
    );

    expect(await processQueue("cron")).toEqual({ processed: 1, failed: 0, remaining: 0 });
    const rows = await query<{ views: number; estimated_revenue: string | null; impressions: number | null }>(
      "SELECT views, estimated_revenue, impressions FROM channel_metrics_daily"
    );
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.views > 0 && r.estimated_revenue === null && r.impressions === null)).toBe(
      true
    );
    expect(await runStatus()).toBe("success");
  });
});
