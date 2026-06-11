CREATE TABLE "channel_metrics_daily" (
	"channel_id" text NOT NULL,
	"date" date NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"estimated_minutes_watched" bigint DEFAULT 0 NOT NULL,
	"average_view_duration_secs" integer DEFAULT 0 NOT NULL,
	"impressions" bigint,
	"impressions_ctr" numeric(8, 4),
	"subscribers_gained" integer DEFAULT 0 NOT NULL,
	"subscribers_lost" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"estimated_revenue" numeric(12, 4),
	"monetized_playbacks" bigint,
	"playback_based_cpm" numeric(12, 4),
	CONSTRAINT "channel_metrics_daily_channel_id_date_pk" PRIMARY KEY("channel_id","date")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"custom_url" text,
	"thumbnail_url" text,
	"google_email" text,
	"refresh_token_enc" text NOT NULL,
	"token_status" text DEFAULT 'active' NOT NULL,
	"uploads_playlist_id" text,
	"subscriber_count" bigint,
	"video_count" bigint,
	"total_view_count" bigint,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"backfill_complete" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demographics_period" (
	"channel_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"age_group" text NOT NULL,
	"gender" text NOT NULL,
	"viewer_percentage" numeric(8, 4) NOT NULL,
	CONSTRAINT "demographics_period_channel_id_age_group_gender_pk" PRIMARY KEY("channel_id","age_group","gender")
);
--> statement-breakpoint
CREATE TABLE "geography_period" (
	"channel_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"range_days" integer NOT NULL,
	"country" text NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"estimated_minutes_watched" bigint DEFAULT 0 NOT NULL,
	"estimated_revenue" numeric(12, 4),
	CONSTRAINT "geography_period_channel_id_range_days_country_pk" PRIMARY KEY("channel_id","range_days","country")
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" text NOT NULL,
	"job_type" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_run_channels" (
	"sync_run_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"rows_upserted" integer DEFAULT 0 NOT NULL,
	"date_from" date,
	"date_to" date,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_run_channels_sync_run_id_channel_id_finished_at_pk" PRIMARY KEY("sync_run_id","channel_id","finished_at")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_sources_daily" (
	"channel_id" text NOT NULL,
	"date" date NOT NULL,
	"source_type" text NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"estimated_minutes_watched" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "traffic_sources_daily_channel_id_date_source_type_pk" PRIMARY KEY("channel_id","date","source_type")
);
--> statement-breakpoint
CREATE TABLE "video_metrics_totals" (
	"video_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"range_days" integer NOT NULL,
	"range_start" date NOT NULL,
	"range_end" date NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"estimated_minutes_watched" bigint DEFAULT 0 NOT NULL,
	"average_view_duration_secs" integer DEFAULT 0 NOT NULL,
	"impressions" bigint,
	"impressions_ctr" numeric(8, 4),
	"estimated_revenue" numeric(12, 4),
	CONSTRAINT "video_metrics_totals_video_id_range_days_pk" PRIMARY KEY("video_id","range_days")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"title" text NOT NULL,
	"thumbnail_url" text,
	"duration_secs" integer,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "channel_metrics_daily" ADD CONSTRAINT "channel_metrics_daily_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demographics_period" ADD CONSTRAINT "demographics_period_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "geography_period" ADD CONSTRAINT "geography_period_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run_channels" ADD CONSTRAINT "sync_run_channels_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_run_channels" ADD CONSTRAINT "sync_run_channels_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_sources_daily" ADD CONSTRAINT "traffic_sources_daily_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_metrics_totals" ADD CONSTRAINT "video_metrics_totals_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_metrics_totals" ADD CONSTRAINT "video_metrics_totals_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;