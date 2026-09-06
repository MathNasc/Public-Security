import Database from 'better-sqlite3';

const db = new Database('local.db');

try {
  db.exec(`
    -- Create new tables
    CREATE TABLE IF NOT EXISTS \`data_datasets\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`source_id\` text NOT NULL,
      \`name\` text NOT NULL,
      \`description\` text,
      \`format\` text,
      \`geographic_level\` text,
      \`period_start\` integer,
      \`period_end\` integer,
      \`last_modified\` integer,
      \`checksum\` text,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS \`data_imports\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`source_id\` text NOT NULL,
      \`dataset_id\` text,
      \`started_at\` integer NOT NULL,
      \`finished_at\` integer,
      \`status\` text NOT NULL,
      \`records_downloaded\` integer DEFAULT 0,
      \`records_parsed\` integer DEFAULT 0,
      \`records_inserted\` integer DEFAULT 0,
      \`records_updated\` integer DEFAULT 0,
      \`records_rejected\` integer DEFAULT 0,
      \`error_message\` text,
      \`checksum\` text,
      \`created_at\` integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS \`security_occurrences\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`source_id\` text NOT NULL,
      \`dataset_id\` text,
      \`source_record_id\` text,
      \`country\` text DEFAULT 'BR' NOT NULL,
      \`state_code\` text,
      \`state_name\` text,
      \`municipality_code\` text,
      \`municipality_name\` text,
      \`category\` text NOT NULL,
      \`subcategory\` text,
      \`occurred_at\` integer,
      \`year\` integer,
      \`month\` integer,
      \`latitude\` real,
      \`longitude\` real,
      \`location_precision\` text,
      \`geocoding_status\` text,
      \`geocoding_provider\` text,
      \`geocoding_confidence\` text,
      \`geocoded_at\` integer,
      \`original_address\` text,
      \`source_data\` text,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS \`occ_src_id_idx\` ON \`security_occurrences\` (\`source_id\`, \`source_record_id\`);
    CREATE INDEX IF NOT EXISTS \`occ_geo_idx\` ON \`security_occurrences\` (\`latitude\`, \`longitude\`);
    CREATE INDEX IF NOT EXISTS \`occ_state_idx\` ON \`security_occurrences\` (\`state_code\`);
    CREATE INDEX IF NOT EXISTS \`occ_city_idx\` ON \`security_occurrences\` (\`municipality_code\`);
    CREATE INDEX IF NOT EXISTS \`occ_date_idx\` ON \`security_occurrences\` (\`occurred_at\`);

    CREATE TABLE IF NOT EXISTS \`security_indicators\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`source_id\` text NOT NULL,
      \`dataset_id\` text,
      \`state_code\` text,
      \`municipality_code\` text,
      \`category\` text NOT NULL,
      \`subcategory\` text,
      \`period\` text NOT NULL,
      \`value\` real NOT NULL,
      \`unit\` text NOT NULL,
      \`population_reference\` integer,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS \`ind_unique_idx\` ON \`security_indicators\` (\`source_id\`, \`state_code\`, \`municipality_code\`, \`category\`, \`period\`);
    CREATE INDEX IF NOT EXISTS \`ind_state_idx\` ON \`security_indicators\` (\`state_code\`);
    CREATE INDEX IF NOT EXISTS \`ind_city_idx\` ON \`security_indicators\` (\`municipality_code\`);
    CREATE INDEX IF NOT EXISTS \`ind_period_idx\` ON \`security_indicators\` (\`period\`);
  `);

  // Migrate DataSources Columns safely
  const addSourceCol = (col: string, def: string) => {
    try { db.exec(`ALTER TABLE \`data_sources\` ADD COLUMN \`${col}\` ${def}`); } catch(e) {}
  };
  addSourceCol('country', "text DEFAULT 'BR' NOT NULL");
  addSourceCol('state', 'text');
  addSourceCol('source_type', 'text');
  addSourceCol('official_url', 'text');
  addSourceCol('documentation_url', 'text');
  addSourceCol('update_frequency', 'text');
  addSourceCol('enabled', 'integer DEFAULT 1');
  addSourceCol('last_successful_import', 'integer');
  addSourceCol('last_attempt', 'integer');
  addSourceCol('created_at', 'integer');
  addSourceCol('updated_at', 'integer');

  try {
    db.exec(`UPDATE \`data_sources\` SET \`created_at\` = 1714521600000 WHERE \`created_at\` IS NULL`);
    db.exec(`UPDATE \`data_sources\` SET \`updated_at\` = 1714521600000 WHERE \`updated_at\` IS NULL`);
  } catch(e) {}

  // Try to copy old occurrences to security_occurrences
  try {
    const hasOld = db.prepare(`SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='occurrences'`).get() as any;
    if (hasOld.c > 0) {
      db.exec(`
        INSERT OR IGNORE INTO \`security_occurrences\` 
        (id, source_id, source_record_id, category, subcategory, occurred_at, latitude, longitude, location_precision, geocoding_status, geocoding_provider, geocoding_confidence, geocoded_at, original_address, created_at, updated_at)
        SELECT id, source, source_id, category, subcategory, occurred_at, latitude, longitude, location_precision, geocoding_status, geocoding_provider, geocoding_confidence, geocoded_at, original_address, created_at, created_at
        FROM \`occurrences\`;
      `);
      console.log("Migrated occurrences to security_occurrences");
    }
  } catch (e) {
    console.error("Failed to migrate occurrences:", e);
  }

  console.log("Migration script V2 completed successfully");
} catch (e) {
  console.error("Migration script failed:", e);
}
