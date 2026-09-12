import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';
async function run() {
   await db.execute(sql`DROP TABLE IF EXISTS data_imports`);
   await db.execute(sql`DROP TABLE IF EXISTS security_occurrences`);
   await db.execute(sql`DROP TABLE IF EXISTS security_indicators`);
   await db.execute(sql`
     CREATE TABLE data_imports (
         id TEXT PRIMARY KEY,
         source_id TEXT,
         dataset_id TEXT,
         records_downloaded INTEGER,
         records_parsed INTEGER,
         records_rejected INTEGER,
         error_message TEXT,
         raw_file_path TEXT,
         original_filename TEXT,
         checksum TEXT,
         file_size INTEGER,
         status TEXT,
         started_at TEXT,
         finished_at TEXT,
         checkpoint TEXT,
         attempts INTEGER,
         last_error TEXT,
         failed_at TEXT,
         worker_id TEXT,
         locked_at TEXT,
         records_read INTEGER,
         records_valid INTEGER,
         records_invalid INTEGER,
         records_inserted INTEGER,
         records_updated INTEGER,
         records_duplicate INTEGER,
         records_without_coordinates INTEGER,
         records_with_invalid_coordinates INTEGER,
         records_with_unknown_municipality INTEGER,
         state_code TEXT,
         period TEXT,
         acquisition_method TEXT,
         origin_url TEXT,
         source_type TEXT,
         environment TEXT,
         is_official_publication BOOLEAN,
         is_eligible_for_production_automation BOOLEAN,
         parser_used TEXT,
         parser_version TEXT,
         quality_status TEXT,
         created_at TEXT
     )
   `);
}
run();
