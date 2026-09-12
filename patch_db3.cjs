const fs = require('fs');
let code = fs.readFileSync('src/db/index.ts', 'utf8');

const target = `    CREATE TABLE IF NOT EXISTS data_sources`;
const replacement = `    CREATE TABLE IF NOT EXISTS source_registry (
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
      expected_columns TEXT,
      notes TEXT,
      status TEXT,
      last_successful_download_at TEXT,
      last_downloaded_hash TEXT,
      last_downloaded_size INTEGER,
      evidence_level TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS data_sources`;

if (code.includes(target) && !code.includes('CREATE TABLE IF NOT EXISTS source_registry')) {
   code = code.replace(target, replacement);
   fs.writeFileSync('src/db/index.ts', code);
   console.log("Patched source_registry");
} else {
   console.log("Target not found or already patched");
}
