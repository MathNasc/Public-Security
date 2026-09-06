ALTER TABLE `data_sources` ADD `provider` text;--> statement-breakpoint
ALTER TABLE `data_sources` ADD `records_imported` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `data_sources` ADD `error_message` text;--> statement-breakpoint
CREATE INDEX `lat_idx` ON `occurrences` (`latitude`);--> statement-breakpoint
CREATE INDEX `lon_idx` ON `occurrences` (`longitude`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `occurrences` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `source_id_idx` ON `occurrences` (`source`,`source_id`);