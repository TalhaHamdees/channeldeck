import { auth } from "@/auth";
import { buildChannelAuthUrl, signState } from "@/lib/google/oauth";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const state = signState(randomBytes(16).toString("base64url"));
  return NextResponse.redirect(buildChannelAuthUrl(state));
}
