import { after, NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueDailyJobs, processQueue } from "@/lib/sync/engine";
import { GET, maxDuration } from "../route";

// next/server's after() needs a live Next request scope; capture the callback instead.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/sync/engine", () => ({
  enqueueDailyJobs: vi.fn(),
  processQueue: vi.fn(),
}));

const CRON_SECRET = "test-cron-secret"; // a placeholder, not a real secret
const APP_URL = "https://channeldeck.test";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  for (const name of [
    "DATABASE_URL",
    "AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "ALLOWED_EMAIL",
    "TOKEN_ENCRYPTION_KEY",
  ]) {
    vi.stubEnv(name, "placeholder");
  }
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
  fetchMock.mockReset().mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(enqueueDailyJobs).mockResolvedValue(0);
  vi.mocked(processQueue).mockResolvedValue({ processed: 0, failed: 0, remaining: 0 });
});

function cronRequest(
  options: { secret?: string | null; vercelCron?: boolean; enqueue?: boolean } = {}
) {
  const { secret = CRON_SECRET, vercelCron = false, enqueue = false } = options;
  const url = new URL("/api/cron/sync", APP_URL);
  if (enqueue) url.searchParams.set("enqueue", "1");
  const headers = new Headers();
  if (secret !== null) headers.set("authorization", `Bearer ${secret}`);
  if (vercelCron) headers.set("x-vercel-cron", "1");
  return new NextRequest(url, { headers });
}

/** Run what the route handed to after(), as Next does once the response is sent. */
async function runAfterCallbacks() {
  for (const [task] of vi.mocked(after).mock.calls) {
    await (task as () => Promise<void>)();
  }
}

describe("GET /api/cron/sync", () => {
  it("rejects requests without the cron secret and does no work", async () => {
    for (const secret of [null, "wrong-secret"]) {
      const res = await GET(cronRequest({ secret }));
      expect(res.status).toBe(401);
    }
    expect(enqueueDailyJobs).not.toHaveBeenCalled();
    expect(processQueue).not.toHaveBeenCalled();
  });

  it("returns 503 before setup is finished", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const res = await GET(cronRequest());
    expect(res.status).toBe(503);
    expect(processQueue).not.toHaveBeenCalled();
  });

  it("a Vercel cron tick queues the nightly jobs, then drains the queue", async () => {
    await GET(cronRequest({ vercelCron: true }));

    expect(enqueueDailyJobs).toHaveBeenCalledOnce();
    expect(processQueue).toHaveBeenCalledWith("cron");
    expect(vi.mocked(enqueueDailyJobs).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(processQueue).mock.invocationCallOrder[0]
    );
  });

  it("?enqueue=1 also queues the nightly jobs", async () => {
    await GET(cronRequest({ enqueue: true }));
    expect(enqueueDailyJobs).toHaveBeenCalledOnce();
  });

  it("a chained invocation only drains what is already queued", async () => {
    await GET(cronRequest());
    expect(enqueueDailyJobs).not.toHaveBeenCalled();
    expect(processQueue).toHaveBeenCalledWith("cron");
  });

  it("does not chain another invocation once the queue is empty", async () => {
    vi.mocked(processQueue).mockResolvedValue({ processed: 4, failed: 1, remaining: 0 });

    const res = await GET(cronRequest({ vercelCron: true }));

    expect(await res.json()).toEqual({ processed: 4, failed: 1, remaining: 0 });
    expect(after).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("chains a fresh invocation, after responding, when the budget ran out with work left", async () => {
    vi.mocked(processQueue).mockResolvedValue({ processed: 3, failed: 0, remaining: 7 });

    const res = await GET(cronRequest({ vercelCron: true }));

    expect(await res.json()).toEqual({ processed: 3, failed: 0, remaining: 7 });
    expect(after).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled(); // not before the response is sent

    await runAfterCallbacks();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    // Same endpoint, authenticated, and without the cron header or ?enqueue=1,
    // so the child only drains the queue and does not queue the nightly jobs again.
    expect(url).toBe(`${APP_URL}/api/cron/sync`);
    expect(init?.headers).toEqual({ Authorization: `Bearer ${CRON_SECRET}` });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("a continuation request that times out does not fail the parent", async () => {
    vi.mocked(processQueue).mockResolvedValue({ processed: 3, failed: 0, remaining: 7 });
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));

    const res = await GET(cronRequest());

    expect(res.status).toBe(200);
    await expect(runAfterCallbacks()).resolves.toBeUndefined();
  });

  it("allows 300 s per invocation, leaving headroom over the engine's 250 s default budget", () => {
    expect(maxDuration).toBe(300);
  });
});
