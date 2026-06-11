import {
  pgTable,
  text,
  date,
  timestamp,
  boolean,
  integer,
  numeric,
  uuid,
  bigint,
  primaryKey,
} from "drizzle-orm/pg-core";

export const channels = pgTable("channels", {
  id: text("id").primaryKey(), // YouTube channel ID (UC...)
  title: text("title").notNull(),
  customUrl: text("custom_url"),
  thumbnailUrl: text("thumbnail_url"),
  googleEmail: text("google_email"),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  tokenStatus: text("token_status", {
    enum: ["active", "revoked", "error"],
  })
    .notNull()
    .default("active"),
  uploadsPlaylistId: text("uploads_playlist_id"),
  subscriberCount: bigint("subscriber_count", { mode: "number" }),
  videoCount: bigint("video_count", { mode: "number" }),
  totalViewCount: bigint("total_view_count", { mode: "number" }),
  connectedAt: timestamp("connected_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  backfillComplete: boolean("backfill_complete").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const channelMetricsDaily = pgTable(
  "channel_metrics_daily",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    views: bigint("views", { mode: "number" }).notNull().default(0),
    estimatedMinutesWatched: bigint("estimated_minutes_watched", {
      mode: "number",
    })
      .notNull()
      .default(0),
    averageViewDurationSecs: integer("average_view_duration_secs")
      .notNull()
      .default(0),
    impressions: bigint("impressions", { mode: "number" }),
    impressionsCtr: numeric("impressions_ctr", { precision: 8, scale: 4 }),
    subscribersGained: integer("subscribers_gained").notNull().default(0),
    subscribersLost: integer("subscribers_lost").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    estimatedRevenue: numeric("estimated_revenue", {
      precision: 12,
      scale: 4,
    }),
    monetizedPlaybacks: bigint("monetized_playbacks", { mode: "number" }),
    playbackBasedCpm: numeric("playback_based_cpm", {
      precision: 12,
      scale: 4,
    }),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.date] })]
);

export const videos = pgTable("videos", {
  id: text("id").primaryKey(),
  channelId: text("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  durationSecs: integer("duration_secs"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const videoMetricsTotals = pgTable(
  "video_metrics_totals",
  {
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    // metrics aggregated over this range (kept per preset range so the
    // top-videos table can answer each of the preset date ranges)
    rangeDays: integer("range_days").notNull(), // 7 | 28 | 90 | 365
    rangeStart: date("range_start").notNull(),
    rangeEnd: date("range_end").notNull(),
    views: bigint("views", { mode: "number" }).notNull().default(0),
    estimatedMinutesWatched: bigint("estimated_minutes_watched", {
      mode: "number",
    })
      .notNull()
      .default(0),
    averageViewDurationSecs: integer("average_view_duration_secs")
      .notNull()
      .default(0),
    impressions: bigint("impressions", { mode: "number" }),
    impressionsCtr: numeric("impressions_ctr", { precision: 8, scale: 4 }),
    estimatedRevenue: numeric("estimated_revenue", {
      precision: 12,
      scale: 4,
    }),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.rangeDays] })]
);

export const trafficSourcesDaily = pgTable(
  "traffic_sources_daily",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    sourceType: text("source_type").notNull(),
    views: bigint("views", { mode: "number" }).notNull().default(0),
    estimatedMinutesWatched: bigint("estimated_minutes_watched", {
      mode: "number",
    })
      .notNull()
      .default(0),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.date, t.sourceType] })]
);

// Country breakdowns are stored as preset-range snapshots (7/28/90/365 days)
// refreshed on every daily sync — per-day country rows would exceed the
// Analytics API's row limits for targeted queries.
export const geographyPeriod = pgTable(
  "geography_period",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    rangeDays: integer("range_days").notNull(), // 7 | 28 | 90 | 365
    country: text("country").notNull(),
    views: bigint("views", { mode: "number" }).notNull().default(0),
    estimatedMinutesWatched: bigint("estimated_minutes_watched", {
      mode: "number",
    })
      .notNull()
      .default(0),
    estimatedRevenue: numeric("estimated_revenue", {
      precision: 12,
      scale: 4,
    }),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.rangeDays, t.country] })]
);

export const demographicsPeriod = pgTable(
  "demographics_period",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    ageGroup: text("age_group").notNull(),
    gender: text("gender").notNull(),
    viewerPercentage: numeric("viewer_percentage", {
      precision: 8,
      scale: 4,
    }).notNull(),
  },
  (t) => [
    // one rolling-28-day snapshot per channel, refreshed nightly
    primaryKey({ columns: [t.channelId, t.ageGroup, t.gender] }),
  ]
);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  trigger: text("trigger", {
    enum: ["cron", "manual", "backfill"],
  }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status", {
    enum: ["running", "success", "partial", "failed"],
  })
    .notNull()
    .default("running"),
});

export const syncRunChannels = pgTable(
  "sync_run_channels",
  {
    syncRunId: uuid("sync_run_id")
      .notNull()
      .references(() => syncRuns.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["success", "failed"] }).notNull(),
    errorMessage: text("error_message"),
    rowsUpserted: integer("rows_upserted").notNull().default(0),
    dateFrom: date("date_from"),
    dateTo: date("date_to"),
    finishedAt: timestamp("finished_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.syncRunId, t.channelId, t.finishedAt] })]
);

export const syncJobs = pgTable("sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: text("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  jobType: text("job_type", {
    enum: ["backfill_chunk", "daily"],
  }).notNull(),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(),
  status: text("status", {
    enum: ["pending", "running", "done", "failed"],
  })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Channel = typeof channels.$inferSelect;
export type ChannelMetricsDaily = typeof channelMetricsDaily.$inferSelect;
export type SyncJob = typeof syncJobs.$inferSelect;
