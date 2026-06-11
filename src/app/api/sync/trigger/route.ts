import { auth } from "@/auth";
import { isConfigured } from "@/lib/config";
import { enqueueDailyJobs, processQueue } from "@/lib/sync/engine";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** "Sync now" button: enqueue daily jobs and drain the queue. */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: "App not configured" }, { status: 503 });
  }

  await enqueueDailyJobs();
  const result = await processQueue("manual");
  return NextResponse.json(result);
}
