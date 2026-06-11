import { InvalidGrantError } from "./oauth";

const DATA_API = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";

async function googleGet(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) {
    const body = await res.text();
    // A 401 on an API call after a successful refresh usually means the
    // grant was revoked between refresh and use; treat both as auth errors.
    if (res.status === 401) throw new InvalidGrantError(body);
    throw new Error(`Google API forbidden (${res.status}): ${body}`);
  }
  if (!res.ok) {
    throw new Error(`Google API error (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// ---------- Data API ----------

export interface MyChannel {
  id: string;
  title: string;
  customUrl: string | null;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string | null;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

/** The channel that the just-authorized identity owns (mine=true). */
export async function fetchMyChannel(accessToken: string): Promise<MyChannel | null> {
  const url = `${DATA_API}/channels?part=snippet,contentDetails,statistics&mine=true`;
  const data = (await googleGet(url, accessToken)) as {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        customUrl?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
      statistics?: {
        subscriberCount?: string;
        videoCount?: string;
        viewCount?: string;
      };
    }>;
  };
  const item = data.items?.[0];
  if (!item) return null;
  return {
    id: item.id,
    title: item.snippet.title,
    customUrl: item.snippet.customUrl ?? null,
    thumbnailUrl:
      item.snippet.thumbnails?.medium?.url ??
      item.snippet.thumbnails?.default?.url ??
      null,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
    subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
    videoCount: Number(item.statistics?.videoCount ?? 0),
    viewCount: Number(item.statistics?.viewCount ?? 0),
  };
}

export interface VideoMeta {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  durationSecs: number;
  publishedAt: string;
}

function parseIsoDuration(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (
    Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  );
}

/** Hydrate titles/thumbnails/durations for up to 50 video IDs per call. */
export async function fetchVideoMeta(
  accessToken: string,
  videoIds: string[]
): Promise<VideoMeta[]> {
  const out: VideoMeta[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = `${DATA_API}/videos?part=snippet,contentDetails&id=${batch.join(",")}`;
    const data = (await googleGet(url, accessToken)) as {
      items?: Array<{
        id: string;
        snippet: {
          title: string;
          publishedAt: string;
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        };
        contentDetails?: { duration?: string };
      }>;
    };
    for (const item of data.items ?? []) {
      out.push({
        id: item.id,
        title: item.snippet.title,
        thumbnailUrl:
          item.snippet.thumbnails?.medium?.url ??
          item.snippet.thumbnails?.default?.url ??
          null,
        durationSecs: parseIsoDuration(item.contentDetails?.duration ?? ""),
        publishedAt: item.snippet.publishedAt,
      });
    }
  }
  return out;
}

/** Channel-level lifetime stats (subscriber count etc.) — cheap, 1 unit. */
export async function fetchChannelStats(
  accessToken: string,
  channelId: string
): Promise<{ subscriberCount: number; videoCount: number; viewCount: number } | null> {
  const url = `${DATA_API}/channels?part=statistics&id=${channelId}`;
  const data = (await googleGet(url, accessToken)) as {
    items?: Array<{
      statistics?: {
        subscriberCount?: string;
        videoCount?: string;
        viewCount?: string;
      };
    }>;
  };
  const stats = data.items?.[0]?.statistics;
  if (!stats) return null;
  return {
    subscriberCount: Number(stats.subscriberCount ?? 0),
    videoCount: Number(stats.videoCount ?? 0),
    viewCount: Number(stats.viewCount ?? 0),
  };
}

// ---------- Analytics API ----------

interface AnalyticsResponse {
  columnHeaders: Array<{ name: string }>;
  rows?: Array<Array<string | number>>;
}

/**
 * Run an Analytics API report and return rows as objects keyed by header name.
 */
export async function analyticsQuery(
  accessToken: string,
  channelId: string,
  params: {
    startDate: string;
    endDate: string;
    metrics: string[];
    dimensions?: string[];
    sort?: string;
    maxResults?: number;
    filters?: string;
  }
): Promise<Array<Record<string, string | number>>> {
  const search = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate: params.startDate,
    endDate: params.endDate,
    metrics: params.metrics.join(","),
  });
  if (params.dimensions?.length) search.set("dimensions", params.dimensions.join(","));
  if (params.sort) search.set("sort", params.sort);
  if (params.maxResults) search.set("maxResults", String(params.maxResults));
  if (params.filters) search.set("filters", params.filters);

  const data = (await googleGet(
    `${ANALYTICS_API}/reports?${search}`,
    accessToken
  )) as AnalyticsResponse;

  const headers = data.columnHeaders.map((h) => h.name);
  return (data.rows ?? []).map((row) =>
    Object.fromEntries(row.map((v, i) => [headers[i], v]))
  );
}
