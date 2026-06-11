import { REVENUE_CURRENCY } from "./config";

export function fmtNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: REVENUE_CURRENCY,
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

/** Minutes → "1,234 hrs" / "12.4K hrs". */
export function fmtWatchHours(minutes: number): string {
  return `${fmtNumber(Math.round(minutes / 60))} hrs`;
}

export function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtSigned(n: number): string {
  return n > 0 ? `+${fmtNumber(n)}` : fmtNumber(n);
}

export function fmtPctDelta(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00Z`) : d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  ADVERTISING: "Advertising",
  ANNOTATION: "Annotations",
  CAMPAIGN_CARD: "Campaign cards",
  END_SCREEN: "End screens",
  EXT_URL: "External",
  HASHTAGS: "Hashtags",
  IMMERSIVE_LIVE: "Live immersive",
  LIVE_REDIRECT: "Live redirect",
  NO_LINK_EMBEDDED: "Embedded (no link)",
  NO_LINK_OTHER: "Direct / unknown",
  NOTIFICATION: "Notifications",
  PLAYLIST: "Playlists",
  PRODUCT_PAGE: "Product pages",
  PROMOTED: "Promoted",
  RELATED_VIDEO: "Suggested videos",
  SHORTS: "Shorts feed",
  SHORTS_CONTENT_LINKS: "Shorts links",
  SOUND_PAGE: "Sound pages",
  SUBSCRIBER: "Subscriptions feed",
  YT_CHANNEL: "Channel pages",
  YT_OTHER_PAGE: "Other YouTube",
  YT_PLAYLIST_PAGE: "Playlist pages",
  YT_SEARCH: "YouTube search",
  VIDEO_REMIXES: "Remixes",
};

export function trafficSourceLabel(type: string): string {
  return TRAFFIC_SOURCE_LABELS[type] ?? type;
}

export function countryName(code: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code
    );
  } catch {
    return code;
  }
}
