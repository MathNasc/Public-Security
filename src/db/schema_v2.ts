import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ==============================================
// 1. DATA SOURCES & DATASETS (Admin & Ingestion)
// ==============================================

export const dataSources = sqliteTable("data_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider"),
  country: text("country").notNull().default("BR"),
  state: text("state"),
  sourceType: text("source_type"), // api, scrape, manual
  officialUrl: text("official_url"),
  documentationUrl: text("documentation_url"),
  updateFrequency: text("update_frequency"), // daily, monthly, etc
  enabled: integer("enabled", { mode: 'boolean' }).default(true),
  lastSuccessfulImport: integer("last_successful_import", { mode: 'timestamp' }),
  lastAttempt: integer("last_attempt", { mode: 'timestamp' }),
  status: text("status"), // OPERATIONAL, DELAYED, FAILING
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
});

export const dataDatasets = sqliteTable("data_datasets", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  format: text("format"),
  geographicLevel: text("geographic_level"), // national, state, granular
  periodStart: integer("period_start", { mode: 'timestamp' }),
  periodEnd: integer("period_end", { mode: 'timestamp' }),
  lastModified: integer("last_modified", { mode: 'timestamp' }),
  checksum: text("checksum"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
});

export const dataImports = sqliteTable("data_imports", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  datasetId: text("dataset_id"),
  startedAt: integer("started_at", { mode: 'timestamp' }).notNull(),
  finishedAt: integer("finished_at", { mode: 'timestamp' }),
  status: text("status").notNull(), // SUCCESS, FAILED, IN_PROGRESS
  recordsDownloaded: integer("records_downloaded").default(0),
  recordsParsed: integer("records_parsed").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsRejected: integer("records_rejected").default(0),
  errorMessage: text("error_message"),
  checksum: text("checksum"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

// ==============================================
// 2. SECURITY RECORDS (Granular vs Aggregated)
// ==============================================

export const securityOccurrences = sqliteTable("security_occurrences", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  datasetId: text("dataset_id"),
  sourceRecordId: text("source_record_id"),
  
  country: text("country").notNull().default('BR'),
  stateCode: text("state_code"), // e.g., SP, RJ
  stateName: text("state_name"),
  municipalityCode: text("municipality_code"), // IBGE code
  municipalityName: text("municipality_name"),
  
  category: text("category").notNull(), // Normalized
  subcategory: text("subcategory"),
  
  occurredAt: integer("occurred_at", { mode: 'timestamp' }),
  year: integer("year"),
  month: integer("month"),
  
  latitude: real("latitude"),
  longitude: real("longitude"),
  locationPrecision: text("location_precision"),
  
  // Quality & Geocoding
  geocodingStatus: text("geocoding_status"),
  geocodingProvider: text("geocoding_provider"),
  geocodingConfidence: text("geocoding_confidence"),
  geocodedAt: integer("geocoded_at", { mode: 'timestamp' }),
  originalAddress: text("original_address"),
  
  sourceData: text("source_data"), // JSON representation of original row
  
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
}, (table) => ({
  geoIdx: index("occ_geo_idx").on(table.latitude, table.longitude),
  stateIdx: index("occ_state_idx").on(table.stateCode),
  cityIdx: index("occ_city_idx").on(table.municipalityCode),
  dateIdx: index("occ_date_idx").on(table.occurredAt),
  srcIdIdx: index("occ_src_id_idx").on(table.sourceId, table.sourceRecordId),
}));

export const securityIndicators = sqliteTable("security_indicators", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  datasetId: text("dataset_id"),
  
  stateCode: text("state_code"),
  municipalityCode: text("municipality_code"),
  
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  
  period: text("period").notNull(), // e.g., "2023", "2023-01", "2023-Q1"
  value: real("value").notNull(),
  unit: text("unit").notNull(), // e.g., "occurrences", "rate_per_100k"
  populationReference: integer("population_reference"),
  
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
}, (table) => ({
  stateIdx: index("ind_state_idx").on(table.stateCode),
  cityIdx: index("ind_city_idx").on(table.municipalityCode),
  periodIdx: index("ind_period_idx").on(table.period),
}));

// ==============================================
// 3. LEGACY / CACHE (Keeping what is necessary for UI compatibility during migration)
// ==============================================

export const geocodingCache = sqliteTable("geocoding_cache", {
  id: text("id").primaryKey(),
  normalizedAddress: text("normalized_address").notNull().unique(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  precision: text("precision").notNull(),
  provider: text("provider").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});
