import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { encryptToken } from "@/lib/crypto";
import { appUrl } from "@/lib/config";
import { exchangeCode, verifyState } from "@/lib/google/oauth";
import { fetchMyChannel } from "@/lib/google/youtube";
import { enqueueBackfill } from "@/lib/sync/engine";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function settingsRedirect(params: Record<string, string>) {
  const url = new URL("/settings", appUrl());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", appUrl()));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) return settingsRedirect({ error: oauthError });
  if (!code || !state || !verifyState(state)) {
    return settingsRedirect({ error: "invalid_state" });
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      // Should not happen with prompt=consent, but guard anyway.
      return settingsRedirect({ error: "no_refresh_token" });
    }

    // Revenue analytics is useless without the monetary scope — catch a
    // partially-granted consent here instead of failing silently at sync time.
    if (!tokens.scope.includes("yt-analytics-monetary.readonly")) {
      return settingsRedirect({ error: "missing_monetary_scope" });
    }

    const channel = await fetchMyChannel(tokens.access_token);
    if (!channel) return settingsRedirect({ error: "no_channel_for_account" });

    const db = getDb();
    await db
      .insert(schema.channels)
      .values({
        id: channel.id,
        title: channel.title,
        customUrl: channel.customUrl,
        thumbnailUrl: channel.thumbnailUrl,
        uploadsPlaylistId: channel.uploadsPlaylistId,
        subscriberCount: channel.subscriberCount,
        videoCount: channel.videoCount,
        totalViewCount: channel.viewCount,
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        tokenStatus: "active",
      })
      .onConflictDoUpdate({
        target: schema.channels.id,
        set: {
          title: channel.title,
          customUrl: channel.customUrl,
          thumbnailUrl: channel.thumbnailUrl,
          uploadsPlaylistId: channel.uploadsPlaylistId,
          subscriberCount: channel.subscriberCount,
          videoCount: channel.videoCount,
          totalViewCount: channel.viewCount,
          refreshTokenEnc: encryptToken(tokens.refresh_token),
          tokenStatus: "active",
        },
      });

    await enqueueBackfill(channel.id);

    // Kick the queue so backfill starts immediately (fire-and-forget).
    fetch(`${appUrl()}/api/cron/sync`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch(() => {});

    return settingsRedirect({ connected: channel.id });
  } catch (err) {
    console.error("Channel connect failed:", err);
    return settingsRedirect({ error: "connect_failed" });
  }
}
