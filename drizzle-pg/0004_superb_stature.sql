CREATE TABLE "generated_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"cache_key" text NOT NULL,
	"summary_text" text NOT NULL,
	"methodology_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generated_summaries_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "region_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"watchlist_id" text NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "region_watchlists" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"radius_meters" integer NOT NULL,
	"last_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_indicators" ADD COLUMN "source_category" text;--> statement-breakpoint
ALTER TABLE "security_occurrences" ADD COLUMN "source_category" text;--> statement-breakpoint
ALTER TABLE "region_alerts" ADD CONSTRAINT "region_alerts_watchlist_id_region_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."region_watchlists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watchlist_user_idx" ON "region_watchlists" USING btree ("user_id");