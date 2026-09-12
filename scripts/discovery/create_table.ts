import { db } from '../../src/db/index.js';

async function run() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS source_registry (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      institution TEXT NOT NULL,
      source_name TEXT NOT NULL,
      official_page TEXT,
      download_url TEXT,
      final_download_url TEXT,
      download_method TEXT,
      requires_auth INTEGER DEFAULT 0,
      requires_session INTEGER DEFAULT 0,
      requires_captcha INTEGER DEFAULT 0,
      content_type TEXT,
      file_format TEXT,
      coverage_start TEXT,
      coverage_end TEXT,
      granularity TEXT,
      has_coordinates INTEGER DEFAULT 0,
      has_municipality_data INTEGER DEFAULT 0,
      has_state_data INTEGER DEFAULT 0,
      periodicity TEXT,
      acquisition_mode TEXT,
      automatable INTEGER DEFAULT 0,
      status TEXT,
      last_checked_at TEXT,
      last_successful_download_at TEXT,
      last_published_period TEXT,
      last_downloaded_hash TEXT,
      last_downloaded_size INTEGER,
      parser_status TEXT,
      ingestion_status TEXT,
      evidence_level TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Table created.");
}
run();
