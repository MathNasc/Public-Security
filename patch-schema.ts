import fs from 'fs';
let code = fs.readFileSync('src/db/schema.ts', 'utf8');

// Modify dataDatasets to add Phase 10 columns
code = code.replace(
  '  checksum: text("checksum"),',
  `  checksum: text("checksum"),
  discoveryFrequency: text("discovery_frequency").notNull().default('monthly'),
  expectedUpdateFrequency: text("expected_update_frequency").notNull().default('monthly'),
  enabled: boolean("enabled").notNull().default(true),
  discoveryUrl: text("discovery_url"),
  parserVersion: text("parser_version"),
  lastDiscoveredAt: timestamp("last_discovered_at", { mode: 'date', withTimezone: true }),
  lastVersion: text("last_version"),
  status: text("status").notNull().default('unknown'),`
);

code += `

// ==============================================
// 6. CONTINUOUS INGESTION (PHASE 10)
// ==============================================

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: text("id").primaryKey(),
  datasetId: text("dataset_id").notNull(),
  sourceId: text("source_id").notNull(),
  status: text("status").notNull(), // queued, processing, completed, failed, dead_letter, no_update
  version: text("version"),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  error: text("error"),
  logs: text("logs"),
  lockedAt: timestamp("locked_at", { mode: 'date', withTimezone: true }),
  lockedBy: text("locked_by"), // worker_id
  nextRetryAt: timestamp("next_retry_at", { mode: 'date', withTimezone: true }),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { mode: 'date', withTimezone: true }),
});

export const rawStorage = pgTable("raw_storage", {
  id: text("id").primaryKey(),
  datasetId: text("dataset_id").notNull(),
  sourceId: text("source_id").notNull(),
  version: text("version").notNull(),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  checksum: text("checksum"),
  size: integer("size"),
  contentType: text("content_type"),
  downloadedAt: timestamp("downloaded_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});
`;

fs.writeFileSync('src/db/schema.ts', code);
