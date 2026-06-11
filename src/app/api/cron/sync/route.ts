import { isConfigured, appUrl } from "@/lib/config";
import { enqueueDailyJobs, processQueue } from "@/lib/sync/engine";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "App not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A real cron tick (Vercel sets this header) enqueues the nightly jobs;
  // chained/self invocations just drain whatever is already queued.
  const isCronTick = req.headers.get("x-vercel-cron") !== null;
  if (isCronTick || req.nextUrl.searchParams.get("enqueue") === "1") {
    await enqueueDailyJobs();
  }

  const result = await processQueue("cron");

  if (result.remaining > 0) {
    // Self-chain: spawn a fresh invocation (its own 300s budget) to keep
    // draining the queue. We only need the request to be *received*.
    after(async () => {
      try {
        await fetch(`${appUrl()}/api/cron/sync`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Timeout/abort is expected; the child invocation continues alone.
      }
    });
  }

  return NextResponse.json(result);
}
