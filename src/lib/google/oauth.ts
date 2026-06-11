import { createHmac, timingSafeEqual } from "crypto";
import { appUrl } from "@/lib/config";

const CHANNEL_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
];

export class InvalidGrantError extends Error {
  constructor(message = "Refresh token revoked or expired") {
    super(message);
    this.name = "InvalidGrantError";
  }
}

export function channelRedirectUri(): string {
  return `${appUrl()}/api/channels/callback`;
}

/** HMAC-signed state so the OAuth callback can't be forged. */
export function signState(nonce: string): string {
  const mac = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(nonce)
    .digest("base64url");
  return `${nonce}.${mac}`;
}

export function verifyState(state: string): boolean {
  const dot = state.lastIndexOf(".");
  if (dot < 0) return false;
  const nonce = state.slice(0, dot);
  const mac = state.slice(dot + 1);
  const expected = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(nonce)
    .digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildChannelAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: channelRedirectUri(),
    response_type: "code",
    scope: CHANNEL_SCOPES.join(" "),
    access_type: "offline",
    // consent → always returns a refresh token; select_account → Google's
    // account chooser, which is how each brand-account channel is picked.
    prompt: "consent select_account",
    state,
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: channelRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 400 && body.includes("invalid_grant")) {
      throw new InvalidGrantError();
    }
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }
  const data: TokenResponse = await res.json();
  return data.access_token;
}

export async function revokeToken(refreshToken: string): Promise<void> {
  // Best-effort: Google returns 200 even for already-revoked tokens.
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }),
  }).catch(() => {});
}
