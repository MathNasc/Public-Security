import { pgTable, text, integer, doublePrecision, timestamp, boolean, geometry, index, uniqueIndex, unique } from "drizzle-orm/pg-core";

// ==============================================
// 1. DATA SOURCES & DATASETS
// ==============================================

export const dataSources = pgTable("data_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider"),
  country: text("country").notNull().default("BR"),
  state: text("state"),
  sourceType: text("source_type"), 
  officialUrl: text("official_url"),
  documentationUrl: text("documentation_url"),
  description: text("description"),
  url: text("url"),
  updateFrequency: text("update_frequency"),
  enabled: boolean("enabled").default(true),
  lastSuccessfulImport: timestamp("last_successful_import", { mode: "date", withTimezone: true }),
  lastAttempt: timestamp("last_attempt", { mode: 'date', withTimezone: true }),
  status: text("status"), // OPERATIONAL, DELAYED, FAILING
  recordsImported: integer("records_imported").default(0),
  coverage: text("coverage"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
});

export const dataDatasets = pgTable("data_datasets", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  format: text("format"),
  geographicLevel: text("geographic_level"),
  periodStart: timestamp("period_start", { mode: 'date', withTimezone: true }),
  periodEnd: timestamp("period_end", { mode: 'date', withTimezone: true }),
  lastModified: timestamp("last_modified", { mode: 'date', withTimezone: true }),
  checksum: text("checksum"),
  discoveryFrequency: text("discovery_frequency").notNull().default('monthly'),
  expectedUpdateFrequency: text("expected_update_frequency").notNull().default('monthly'),
  enabled: boolean("enabled").notNull().default(true),
  discoveryUrl: text("discovery_url"),
  parserVersion: text("parser_version"),
  lastDiscoveredAt: timestamp("last_discovered_at", { mode: 'date', withTimezone: true }),
  lastVersion: text("last_version"),
  status: text("status").notNull().default('unknown'),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
});

// ==============================================
// 1.5. SOURCE DISCOVERY REGISTRY
// ==============================================
export const sourceRegistry = pgTable("source_registry", {
  id: text("id").primaryKey(), // UUID
  state: text("state").notNull(), // UF
  institution: text("institution").notNull(),
  sourceName: text("source_name").notNull(), 
  officialPage: text("official_page"),
  downloadUrl: text("download_url"),
  finalDownloadUrl: text("final_download_url"),
  downloadMethod: text("download_method"),
  requiresAuth: boolean("requires_auth").default(false),
  requiresSession: boolean("requires_session").default(false),
  requiresCaptcha: boolean("requires_captcha").default(false),
  contentType: text("content_type"),
  fileFormat: text("file_format"),
  coverageStart: text("coverage_start"),
  coverageEnd: text("coverage_end"),
  granularity: text("granularity"),
  hasCoordinates: boolean("has_coordinates").default(false),
  hasMunicipalityData: boolean("has_municipality_data").default(false),
  hasStateData: boolean("has_state_data").default(false),
  periodicity: text("periodicity"),
  acquisitionMode: text("acquisition_mode"), // automatic, semi_automatic, manual_upload, unavailable, document_only, api, unknown
  automatable: boolean("automatable").default(false),
  status: text("status"), // discovered, verified, downloadable, partially_available, manual_only, unavailable, blocked, deprecated, not_investigated
  lastCheckedAt: timestamp("last_checked_at", { mode: 'date', withTimezone: true }),
  lastSuccessfulDownloadAt: timestamp("last_successful_download_at", { mode: 'date', withTimezone: true }),
  lastPublishedPeriod: text("last_published_period"),
  lastDownloadedHash: text("last_downloaded_hash"),
  lastDownloadedSize: integer("last_downloaded_size"),
  parserStatus: text("parser_status"),
  ingestionStatus: text("ingestion_status"),
  evidenceLevel: text("evidence_level"), // E0 to E7
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});

export const dataImports = pgTable("data_imports", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  datasetId: text("dataset_id"),
  
  // Legacy Columns (Kept to avoid destructive migration prompt)
  recordsDownloaded: integer("records_downloaded").default(0),
  recordsParsed: integer("records_parsed").default(0),
  recordsRejected: integer("records_rejected").default(0),
  errorMessage: text("error_message"),
  
  // Raw File Metadata
  rawFilePath: text("raw_file_path"),
  originalFilename: text("original_filename"),
  checksum: text("checksum"),
  fileSize: integer("file_size"),
  
  // Job Status
  status: text("status").notNull().default("QUEUED"), // QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED
  startedAt: timestamp("started_at", { mode: 'date', withTimezone: true }),
  finishedAt: timestamp("finished_at", { mode: 'date', withTimezone: true }),
  
  // Job Retry & Checkpoint
  checkpoint: text("checkpoint"), // e.g. line number or bytes read
  attempts: integer("attempts").default(0),
  lastError: text("last_error"),
  failedAt: timestamp("failed_at", { mode: 'date', withTimezone: true }),
  
  // Locking for Concurrency
  workerId: text("worker_id"),
  lockedAt: timestamp("locked_at", { mode: 'date', withTimezone: true }),

  // Data Quality Metrics
  recordsRead: integer("records_read").default(0),
  recordsValid: integer("records_valid").default(0),
  recordsInvalid: integer("records_invalid").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsDuplicate: integer("records_duplicate").default(0),
  recordsWithoutCoordinates: integer("records_without_coordinates").default(0),
  recordsWithInvalidCoordinates: integer("records_with_invalid_coordinates").default(0),
  recordsWithUnknownMunicipality: integer("records_with_unknown_municipality").default(0),
  
  // Provenance & Acquisition Metadata
  stateCode: text("state_code"),
  period: text("period"),
  acquisitionMethod: text("acquisition_method").default("MANUAL_UPLOAD"),
  originUrl: text("origin_url"),
  sourceType: text("source_type").default("official_download"), // fixture, manual_upload, official_download
  environment: text("environment").default("production"), // test, production
  isOfficialPublication: boolean("is_official_publication").default(true),
  isEligibleForProductionAutomation: boolean("is_eligible_for_production_automation").default(true),
  parserUsed: text("parser_used"),
  parserVersion: text("parser_version"),
  qualityStatus: text("quality_status").default("PENDING"),

  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});

// ==============================================
// 2. SECURITY RECORDS
// ==============================================

export const securityOccurrences = pgTable("security_occurrences", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  datasetId: text("dataset_id"),
  sourceRecordId: text("source_record_id"),
  
  country: text("country").notNull().default('BR'),
  stateCode: text("state_code"),
  stateName: text("state_name"),
  municipalityCode: text("municipality_code"),
  municipalityName: text("municipality_name"),
  
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  sourceCategory: text("source_category"),
  
  occurredAt: timestamp("occurred_at", { mode: 'date', withTimezone: true }),
  year: integer("year"),
  month: integer("month"),
  
  // Kept for compatibility during phase 1
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  // New PostGIS geometry column (SRID 4326: WGS 84)
  geom: geometry("geom", { type: "point", mode: "xy", srid: 4326 }),

  locationPrecision: text("location_precision").default('exact'), // exact, approximate, municipality_centroid, none
  isSyntheticPoint: boolean("is_synthetic_point").notNull().default(false), // MANDATORY: Explicit flag for artificial/centroid points
  
  geocodingStatus: text("geocoding_status"),
  geocodingProvider: text("geocoding_provider"),
  geocodingConfidence: text("geocoding_confidence"),
  geocodedAt: timestamp("geocoded_at", { mode: 'date', withTimezone: true }),
  originalAddress: text("original_address"),
  
  sourceData: text("source_data"), // JSON
  
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
}, (table) => ({
  geomIdx: index("occ_geom_idx").using("gist", table.geom), // GIST index for spatial queries (SRID 4326)
  geoIdx: index("occ_geo_idx").on(table.latitude, table.longitude), // Bounding box index
  stateIdx: index("occ_state_idx").on(table.stateCode),
  cityIdx: index("occ_city_idx").on(table.municipalityCode),
  dateIdx: index("occ_date_idx").on(table.occurredAt),
  periodIdx: index("occ_year_month_idx").on(table.year, table.month),
  catIdx: index("occ_cat_idx").on(table.category),
  srcIdIdx: uniqueIndex("occ_src_id_idx").on(table.sourceId, table.sourceRecordId), // Unique for UPSERT
}));

export const securityIndicators = pgTable("security_indicators", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  datasetId: text("dataset_id"),
  
  stateCode: text("state_code"),
  municipalityCode: text("municipality_code"),
  
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  sourceCategory: text("source_category"),
  
  period: text("period").notNull(), 
  value: doublePrecision("value").notNull(),
  unit: text("unit").notNull(),
  populationReference: integer("population_reference"),
  granularity: text("granularity").default("municipality"), // municipality, state, national
  
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
}, (table) => ({
  sourceIdx: index("ind_source_idx").on(table.sourceId),
  stateIdx: index("ind_state_idx").on(table.stateCode),
  cityIdx: index("ind_city_idx").on(table.municipalityCode),
  periodIdx: index("ind_period_idx").on(table.period),
  catIdx: index("ind_cat_idx").on(table.category),
  uniqueIndIdx: uniqueIndex("ind_unique_idx").on(table.sourceId, table.stateCode, table.municipalityCode, table.category, table.period), // Unique for UPSERT
}));

// ==============================================
// 3. CACHE & ANALYSIS
// ==============================================

export const geocodingCache = pgTable("geocoding_cache", {
  id: text("id").primaryKey(),
  normalizedAddress: text("normalized_address").notNull().unique(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  geom: geometry("geom", { type: "point", mode: "xy", srid: 4326 }),
  precision: text("precision").notNull(),
  provider: text("provider").notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
});

export const safetyAnalyses = pgTable("safety_analyses", {
  id: text("id").primaryKey(),
  locationId: text("location_id").notNull(),
  radiusMeters: integer("radius_meters").notNull(),
  periodStart: timestamp("period_start", { mode: 'date', withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { mode: 'date', withTimezone: true }).notNull(),
  score: integer("score").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
});

export const locations = pgTable("locations", {
  id: text("id").primaryKey(),
  formattedAddress: text("formatted_address").notNull(),
  street: text("street"),
  number: text("number"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  geom: geometry("geom", { type: "point", mode: "xy", srid: 4326 }),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
});

// ==============================================
// 4. GEOGRAPHIC LAYER (IBGE)
// ==============================================

export const geographicStates = pgTable("geographic_states", {
  code: text("code").primaryKey(), // IBGE code (2 digits)
  acronym: text("acronym").notNull().unique(), // UF (e.g. SP, RJ)
  name: text("name").notNull(),
  region: text("region"),
  geom: geometry("geom", { type: "Geometry", mode: "xy", srid: 4326 }), // Polygons
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
});

export const geographicMunicipalities = pgTable("geographic_municipalities", {
  code: text("code").primaryKey(), // IBGE code (7 digits)
  stateCode: text("state_code").notNull().references(() => geographicStates.code), // Links to geographicStates.code
  stateAcronym: text("state_acronym").notNull(), // e.g. SP
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(), // no accents, lowercase for searching
  population: integer("population"), // From census/estimativas
  latitude: doublePrecision("latitude"), // Centroid (SRID 4326)
  longitude: doublePrecision("longitude"), // Centroid (SRID 4326)
  geom: geometry("geom", { type: "Geometry", mode: "xy", srid: 4326 }), // Polygons
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
}, (table) => ({
  stateIdx: index("muni_state_idx").on(table.stateAcronym),
  stateCodeIdx: index("muni_state_code_idx").on(table.stateCode),
  normNameIdx: index("muni_norm_name_idx").on(table.normalizedName),
  coordsIdx: index("muni_coords_idx").on(table.latitude, table.longitude),
  uniqueStateNorm: uniqueIndex("muni_state_norm_idx").on(table.stateAcronym, table.normalizedName),
  geomIdx: index("muni_geom_idx").using("gist", table.geom),
}));

// ==============================================
// 5. ANALYTICS & INTELLIGENCE (PHASE 10)
// ==============================================

export const regionWatchlists = pgTable("region_watchlists", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(), // can be an email or session id for MVP
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radiusMeters: integer("radius_meters").notNull(),
  lastScore: integer("last_score"),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index("watchlist_user_idx").on(table.userId),
}));

export const regionAlerts = pgTable("region_alerts", {
  id: text("id").primaryKey(),
  watchlistId: text("watchlist_id").notNull().references(() => regionWatchlists.id),
  type: text("type").notNull(), // 'score_change', 'indicator_change'
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});

export const generatedSummaries = pgTable("generated_summaries", {
  id: text("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(), // lat_lon_radius_period
  summaryText: text("summary_text").notNull(),
  methodologyVersion: text("methodology_version").notNull(),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull().defaultNow(),
});



// ==============================================
// 6. CONTINUOUS INGESTION (DEPRECATED LEGACY SCHEMA)
// ==============================================

/**
 * @deprecated TABELA OBSOLETA / LEGADA.
 * O pipeline de ingestão ativo utiliza exclusivamente a tabela canonical 'data_imports' (dataImports).
 * Esta definição é mantida apenas para retrocompatibilidade de tipos Drizzle.
 */
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
