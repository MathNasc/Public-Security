import Database from 'better-sqlite3';
const db = new Database('local.db');

try { db.exec(`DROP TABLE \`__new_occurrences\``); } catch (e) {}

db.exec(`
CREATE TABLE \`__new_occurrences\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`source\` text NOT NULL,
	\`source_id\` text,
	\`category\` text NOT NULL,
	\`subcategory\` text,
	\`occurred_at\` integer,
	\`latitude\` real,
	\`longitude\` real,
	\`location_precision\` text,
	\`geocoding_status\` text,
	\`geocoding_provider\` text,
	\`geocoding_confidence\` text,
	\`geocoded_at\` integer,
	\`original_address\` text,
	\`import_batch_id\` text,
	\`created_at\` integer NOT NULL
);
INSERT INTO \`__new_occurrences\`
(id, source, source_id, category, subcategory, occurred_at, latitude, longitude, location_precision, geocoding_status, geocoding_provider, geocoding_confidence, geocoded_at, original_address, import_batch_id, created_at)
SELECT id, source, source_id, category, subcategory, occurred_at, latitude, longitude, location_precision, geocoding_status, geocoding_provider, geocoding_confidence, geocoded_at, original_address, import_batch_id, IFNULL(created_at, 0)
FROM \`occurrences\`;

DROP TABLE \`occurrences\`;
ALTER TABLE \`__new_occurrences\` RENAME TO \`occurrences\`;
CREATE INDEX IF NOT EXISTS \`lat_idx\` ON \`occurrences\` (\`latitude\`);
CREATE INDEX IF NOT EXISTS \`lon_idx\` ON \`occurrences\` (\`longitude\`);
CREATE INDEX IF NOT EXISTS \`date_idx\` ON \`occurrences\` (\`occurred_at\`);
CREATE INDEX IF NOT EXISTS \`source_id_idx\` ON \`occurrences\` (\`source\`,\`source_id\`);
CREATE INDEX IF NOT EXISTS \`batch_idx\` ON \`occurrences\` (\`import_batch_id\`);
`);
console.log("Migrated occurrences to nullable columns");
