import Database from 'better-sqlite3'; // or use libsql

const db = new Database('local.db');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS \`geocoding_cache\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`normalized_address\` text NOT NULL,
      \`latitude\` real NOT NULL,
      \`longitude\` real NOT NULL,
      \`precision\` text NOT NULL,
      \`provider\` text NOT NULL,
      \`created_at\` integer NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS \`geocoding_cache_normalized_address_unique\` ON \`geocoding_cache\` (\`normalized_address\`);
    
    CREATE TABLE IF NOT EXISTS \`import_batches\` (
      \`id\` text PRIMARY KEY NOT NULL,
      \`source_name\` text NOT NULL,
      \`filename\` text,
      \`total_records\` integer NOT NULL,
      \`valid_records\` integer NOT NULL,
      \`rejected_records\` integer NOT NULL,
      \`with_coordinates\` integer NOT NULL,
      \`without_coordinates\` integer NOT NULL,
      \`duplicates\` integer NOT NULL,
      \`geocoded\` integer NOT NULL,
      \`started_at\` integer NOT NULL,
      \`completed_at\` integer
    );
  `);
  
  // Add columns to occurrences if they don't exist
  const addColumn = (col: string, def: string) => {
    try {
      db.exec(`ALTER TABLE \`occurrences\` ADD COLUMN \`${col}\` ${def}`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) console.error(e);
    }
  };
  
  addColumn('geocoding_status', 'text');
  addColumn('geocoding_provider', 'text');
  addColumn('geocoding_confidence', 'text');
  addColumn('geocoded_at', 'integer');
  addColumn('original_address', 'text');
  addColumn('import_batch_id', 'text');
  
  console.log('Database updated manually.');
} catch (e) {
  console.error(e);
}
