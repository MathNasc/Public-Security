ALTER TABLE "data_sources" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "data_sources" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "data_sources" ADD COLUMN "last_updated_at" timestamp with time zone;