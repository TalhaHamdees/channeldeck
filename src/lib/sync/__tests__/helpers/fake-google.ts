import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, vi } from "vitest";
import { InvalidGrantError, refreshAccessToken } from "@/lib/google/oauth";
import {
  analyticsQuery,
  fetchChannelStats,
  fetchVideoMeta,
  type VideoMeta,
} from "@/lib/google/youtube";
import { eachDay } from "./days";

/**
 * A deterministic stand-in for Google's OAuth token endpoint, the YouTube
 * Analytics API and the YouTube Data API. It returns made-up but stable
 * numbers, records every call, and can be told to fail per channel or per
 * metric. Test files route the engine to it by mocking "@/lib/google/oauth"
 * (refreshAccessToken only) and "@/lib/google/youtube", then calling
 * withFakeGoogle().
 */

export const refreshTokenFor = (channelId: string) => `refresh-token:${channelId}`;
export const accessTokenFor = (channelId: string) => `access-token:${channelId}`;

type Row = Record<string, string | number>;
type AnalyticsParams = Parameters<typeof analyticsQuery>[2];

export interface AnalyticsCall {
  channelId: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
}

const TRAFFIC_SOURCES = ["SUBSCRIBER", "YT_SEARCH"];

/** Stable per-day view count, so re-syncs see the same data. */
export const viewsOn = (day: string) =>
  1000 + Number(day.slice(5, 7)) * 31 + Number(day.slice(8, 10));

export class FakeGoogle {
  /** Channels whose refresh token Google rejects with invalid_grant. */
  revokedTokens = new Set<string>();
  /** Channels whose every Analytics call fails with the given error. */
  failingChannels = new Map<string, Error>();
  /** Analytics calls requesting this metric fail with the given error. */
  failingMetrics = new Map<string, Error>();
  /** Added to each day's revenue and views: models YouTube's late revisions. */
  revenueAdjustment = 0;
  viewsAdjustment = 0;
  /** The channel's top videos, best first. */
  topVideoIds = ["vid-a", "vid-b", "vid-c"];
  /** Fake wall-clock time every API call takes (keeps DB timestamps distinct). */
  callLatencyMs = 1;
  /** Extra time charged once per job, on its core daily-metrics query. */
  jobDurationMs = 0;

  refreshCalls: string[] = [];
  analyticsCalls: AnalyticsCall[] = [];

  reset(): void {
    this.revokedTokens.clear();
    this.failingChannels.clear();
    this.failingMetrics.clear();
    this.revenueAdjustment = 0;
    this.viewsAdjustment = 0;
    this.topVideoIds = ["vid-a", "vid-b", "vid-c"];
    this.callLatencyMs = 1;
    this.jobDurationMs = 0;
    this.refreshCalls = [];
    this.analyticsCalls = [];
  }

  refreshAccessToken = async (refreshToken: string): Promise<string> => {
    this.tick(this.callLatencyMs);
    const channelId = refreshToken.replace("refresh-token:", "");
    this.refreshCalls.push(channelId);
    if (this.revokedTokens.has(channelId)) throw new InvalidGrantError();
    return accessTokenFor(channelId);
  };

  analyticsQuery = async (
    accessToken: string,
    channelId: string,
    params: AnalyticsParams
  ): Promise<Row[]> => {
    this.tick(this.callLatencyMs);
    const dimensions = params.dimensions ?? [];
    this.analyticsCalls.push({
      channelId,
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions,
      metrics: params.metrics,
    });

    if (accessToken !== accessTokenFor(channelId)) {
      throw new Error(`FakeGoogle: ${channelId} queried with another channel's token`);
    }
    const channelError = this.failingChannels.get(channelId);
    if (channelError) throw channelError;
    for (const metric of params.metrics) {
      const metricError = this.failingMetrics.get(metric);
      if (metricError) throw metricError;
    }

    const days = () => eachDay(params.startDate, params.endDate);
    const has = (metric: string) => params.metrics.includes(metric);

    switch (dimensions.join(",")) {
      case "day":
        if (has("views")) {
          this.tick(this.jobDurationMs);
          return days().map((day) => ({
            day,
            views: viewsOn(day) + this.viewsAdjustment,
            estimatedMinutesWatched: viewsOn(day) * 3,
            averageViewDuration: 180,
            subscribersGained: 12,
            subscribersLost: 2,
            likes: 40,
            comments: 5,
            shares: 3,
          }));
        }
        if (has("estimatedRevenue")) {
          return days().map((day) => ({
            day,
            estimatedRevenue: viewsOn(day) / 500 + this.revenueAdjustment,
            monetizedPlaybacks: Math.round(viewsOn(day) / 2),
            playbackBasedCpm: 4,
          }));
        }
        if (has("videoThumbnailImpressions")) {
          return days().map((day) => ({
            day,
            videoThumbnailImpressions: viewsOn(day) * 10,
            videoThumbnailImpressionsClickRate: 0.05,
          }));
        }
        break;
      case "day,insightTrafficSourceType":
        return days().flatMap((day) =>
          TRAFFIC_SOURCES.map((source, i) => ({
            day,
            insightTrafficSourceType: source,
            views: Math.round(viewsOn(day) / (i + 2)),
            estimatedMinutesWatched: viewsOn(day),
          }))
        );
      case "video":
        return this.topVideoIds.map((video, i): Row =>
          has("views")
            ? { video, views: 500 - i * 100, estimatedMinutesWatched: 900, averageViewDuration: 200 }
            : { video, estimatedRevenue: 3 - i }
        );
      case "country":
        return [
          { country: "US", views: 700, estimatedMinutesWatched: 2100, estimatedRevenue: 5 },
          { country: "PK", views: 300, estimatedMinutesWatched: 900, estimatedRevenue: 1 },
        ];
      case "ageGroup,gender":
        return [
          { ageGroup: "age25-34", gender: "male", viewerPercentage: 60 },
          { ageGroup: "age25-34", gender: "female", viewerPercentage: 40 },
        ];
    }
    throw new Error(`FakeGoogle: unexpected query ${dimensions} / ${params.metrics}`);
  };

  fetchChannelStats = async () => {
    this.tick(this.callLatencyMs);
    return { subscriberCount: 1200, videoCount: 30, viewCount: 450_000 };
  };

  fetchVideoMeta = async (_token: string, ids: string[]): Promise<VideoMeta[]> => {
    this.tick(this.callLatencyMs);
    return ids.map((id) => ({
      id,
      title: `Video ${id}`,
      thumbnailUrl: null,
      durationSecs: 600,
      publishedAt: "2026-01-15T12:00:00Z",
    }));
  };

  /** Calls whose date range was synced for a channel (core metrics queries only). */
  syncedRanges(channelId: string) {
    return this.analyticsCalls
      .filter((c) => c.channelId === channelId && c.metrics.includes("subscribersGained"))
      .map((c) => ({ dateFrom: c.startDate, dateTo: c.endDate }));
  }

  private tick(ms: number): void {
    if (ms > 0 && vi.isFakeTimers()) vi.setSystemTime(Date.now() + ms);
  }
}

/**
 * Install a fresh FakeGoogle before each test, plus a throwaway token
 * encryption key (generated per run; channels' refresh tokens are encrypted
 * with it exactly as in production).
 */
export function withFakeGoogle(): FakeGoogle {
  const google = new FakeGoogle();
  beforeEach(() => {
    google.reset();
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
    vi.mocked(refreshAccessToken).mockImplementation(google.refreshAccessToken);
    vi.mocked(analyticsQuery).mockImplementation(google.analyticsQuery);
    vi.mocked(fetchChannelStats).mockImplementation(google.fetchChannelStats);
    vi.mocked(fetchVideoMeta).mockImplementation(google.fetchVideoMeta);
  });
  return google;
}

/**
 * Freeze Date at `iso` for each test. Only Date is faked; real timers keep
 * running. FakeGoogle moves the clock forward as API calls "take time".
 */
export function withFixedClock(iso: string): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
