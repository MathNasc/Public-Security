CREATE TABLE "ingestion_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"source_id" text NOT NULL,
	"status" text NOT NULL,
	"version" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"error" text,
	"logs" text,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "raw_storage" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"source_id" text NOT NULL,
	"version" text NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"checksum" text,
	"size" integer,
	"content_type" text,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_datasets" ADD COLUMN "discovery_frequency" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "data_datasets" ADD COLUMN "expected_update_frequency" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "data_datasets" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "data_datasets" ADD COLUMN "discovery_url" text;--> statement-breakpoint
ALTER TABLE "data_datasets" ADD COLUMN "parser_version" text;--> statement-breakpoint
ALTER TABLE "data_datasets" ADD COLUMN "last_discovered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "data_datasets" ADD COLUMN "last_version" text;--> statement-breakpoint
ALTER TABLE "data_datasets" ADD COLUMN "status" text DEFAULT 'unknown' NOT NULL;