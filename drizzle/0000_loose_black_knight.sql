CREATE TABLE `data_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`url` text,
	`last_updated_at` integer,
	`coverage` text,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`formatted_address` text NOT NULL,
	`street` text,
	`number` text,
	`neighborhood` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`category` text NOT NULL,
	`subcategory` text,
	`occurred_at` integer NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`location_precision` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `safety_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`radius_meters` integer NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`score` integer NOT NULL,
	`confidence` real NOT NULL,
	`created_at` integer NOT NULL
);
