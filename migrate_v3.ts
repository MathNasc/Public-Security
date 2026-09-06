import Database from 'better-sqlite3';

const db = new Database('local.db');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS \`geographic_states\` (
      \`code\` text PRIMARY KEY NOT NULL,
      \`acronym\` text NOT NULL UNIQUE,
      \`name\` text NOT NULL,
      \`region\` text,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS \`geographic_municipalities\` (
      \`code\` text PRIMARY KEY NOT NULL,
      \`state_code\` text NOT NULL,
      \`state_acronym\` text NOT NULL,
      \`name\` text NOT NULL,
      \`normalized_name\` text NOT NULL,
      \`population\` integer,
      \`latitude\` real,
      \`longitude\` real,
      \`created_at\` integer NOT NULL,
      \`updated_at\` integer NOT NULL
    );

    CREATE INDEX IF NOT EXISTS \`muni_state_idx\` ON \`geographic_municipalities\` (\`state_acronym\`);
    CREATE INDEX IF NOT EXISTS \`muni_norm_name_idx\` ON \`geographic_municipalities\` (\`normalized_name\`);
  `);

  console.log("Migration script V3 (Geographic layer) completed successfully");
} catch (e) {
  console.error("Migration script failed:", e);
}
