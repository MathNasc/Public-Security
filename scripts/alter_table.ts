import { db } from '../src/db/index.js';

async function run() {
  const queries = [
    "ALTER TABLE data_imports ADD COLUMN source_type TEXT DEFAULT 'official_download';",
    "ALTER TABLE data_imports ADD COLUMN environment TEXT DEFAULT 'production';",
    "ALTER TABLE data_imports ADD COLUMN is_official_publication INTEGER DEFAULT 1;",
    "ALTER TABLE data_imports ADD COLUMN is_eligible_for_production_automation INTEGER DEFAULT 1;"
  ];
  for (const q of queries) {
    try {
      await db.execute(q);
      console.log("Executed:", q);
    } catch (err) {
      console.log("Failed (might already exist):", q, err.message);
    }
  }
}
run();
