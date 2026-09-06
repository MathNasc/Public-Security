CREATE TABLE "data_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"format" text,
	"geographic_level" text,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"last_modified" timestamp with time zone,
	"checksum" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"dataset_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"records_downloaded" integer DEFAULT 0,
	"records_parsed" integer DEFAULT 0,
	"records_inserted" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_rejected" integer DEFAULT 0,
	"error_message" text,
	"checksum" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text,
	"country" text DEFAULT 'BR' NOT NULL,
	"state" text,
	"source_type" text,
	"official_url" text,
	"documentation_url" text,
	"update_frequency" text,
	"enabled" boolean DEFAULT true,
	"last_successful_import" timestamp with time zone,
	"last_attempt" timestamp with time zone,
	"status" text,
	"records_imported" integer DEFAULT 0,
	"coverage" text,
	"error_message" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geocoding_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"normalized_address" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"geom" geometry(point),
	"precision" text NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "geocoding_cache_normalized_address_unique" UNIQUE("normalized_address")
);
--> statement-breakpoint
CREATE TABLE "geographic_municipalities" (
	"code" text PRIMARY KEY NOT NULL,
	"state_code" text NOT NULL,
	"state_acronym" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"population" integer,
	"latitude" double precision,
	"longitude" double precision,
	"geom" geometry(point),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "geographic_states" (
	"code" text PRIMARY KEY NOT NULL,
	"acronym" text NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"geom" geometry(point),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "geographic_states_acronym_unique" UNIQUE("acronym")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"formatted_address" text NOT NULL,
	"street" text,
	"number" text,
	"neighborhood" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"geom" geometry(point),
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"location_id" text NOT NULL,
	"radius_meters" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"score" integer NOT NULL,
	"confidence" double precision NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_indicators" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"dataset_id" text,
	"state_code" text,
	"municipality_code" text,
	"category" text NOT NULL,
	"subcategory" text,
	"period" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text NOT NULL,
	"population_reference" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_occurrences" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"dataset_id" text,
	"source_record_id" text,
	"country" text DEFAULT 'BR' NOT NULL,
	"state_code" text,
	"state_name" text,
	"municipality_code" text,
	"municipality_name" text,
	"category" text NOT NULL,
	"subcategory" text,
	"occurred_at" timestamp with time zone,
	"year" integer,
	"month" integer,
	"latitude" double precision,
	"longitude" double precision,
	"geom" geometry(point),
	"location_precision" text,
	"geocoding_status" text,
	"geocoding_provider" text,
	"geocoding_confidence" text,
	"geocoded_at" timestamp with time zone,
	"original_address" text,
	"source_data" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "muni_state_idx" ON "geographic_municipalities" USING btree ("state_acronym");--> statement-breakpoint
CREATE INDEX "muni_norm_name_idx" ON "geographic_municipalities" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "muni_geom_idx" ON "geographic_municipalities" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "ind_state_idx" ON "security_indicators" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "ind_city_idx" ON "security_indicators" USING btree ("municipality_code");--> statement-breakpoint
CREATE INDEX "ind_period_idx" ON "security_indicators" USING btree ("period");--> statement-breakpoint
CREATE UNIQUE INDEX "ind_unique_idx" ON "security_indicators" USING btree ("source_id","state_code","municipality_code","category","period");--> statement-breakpoint
CREATE INDEX "occ_geom_idx" ON "security_occurrences" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "occ_geo_idx" ON "security_occurrences" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "occ_state_idx" ON "security_occurrences" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "occ_city_idx" ON "security_occurrences" USING btree ("municipality_code");--> statement-breakpoint
CREATE INDEX "occ_date_idx" ON "security_occurrences" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "occ_src_id_idx" ON "security_occurrences" USING btree ("source_id","source_record_id");