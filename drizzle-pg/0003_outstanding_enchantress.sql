ALTER TABLE "data_imports" ALTER COLUMN "started_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "data_imports" ALTER COLUMN "status" SET DEFAULT 'QUEUED';--> statement-breakpoint
ALTER TABLE "data_imports" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "raw_file_path" text;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "original_filename" text;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "checkpoint" text;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "attempts" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "worker_id" text;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "records_read" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "records_valid" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "records_invalid" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "records_duplicate" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "records_without_coordinates" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "records_with_invalid_coordinates" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "records_with_unknown_municipality" integer DEFAULT 0;