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
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
});

export const dataImports = pgTable("data_imports", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  datasetId: text("dataset_id"),
  startedAt: timestamp("started_at", { mode: 'date', withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { mode: 'date', withTimezone: true }),
  status: text("status").notNull(), // SUCCESS, FAILED, IN_PROGRESS
  recordsDownloaded: integer("records_downloaded").default(0),
  recordsParsed: integer("records_parsed").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsRejected: integer("records_rejected").default(0),
  errorMessage: text("error_message"),
  checksum: text("checksum"),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
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
  
  occurredAt: timestamp("occurred_at", { mode: 'date', withTimezone: true }),
  year: integer("year"),
  month: integer("month"),
  
  // Kept for compatibility during phase 1
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  // New PostGIS geometry column
  geom: geometry("geom", { type: "point", mode: "xy", srid: 4326 }),

  locationPrecision: text("location_precision"),
  
  geocodingStatus: text("geocoding_status"),
  geocodingProvider: text("geocoding_provider"),
  geocodingConfidence: text("geocoding_confidence"),
  geocodedAt: timestamp("geocoded_at", { mode: 'date', withTimezone: true }),
  originalAddress: text("original_address"),
  
  sourceData: text("source_data"), // JSON
  
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
}, (table) => ({
  geomIdx: index("occ_geom_idx").using("gist", table.geom), // GIST index for spatial queries
  geoIdx: index("occ_geo_idx").on(table.latitude, table.longitude), // Legacy compat
  stateIdx: index("occ_state_idx").on(table.stateCode),
  cityIdx: index("occ_city_idx").on(table.municipalityCode),
  dateIdx: index("occ_date_idx").on(table.occurredAt),
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
  
  period: text("period").notNull(), 
  value: doublePrecision("value").notNull(),
  unit: text("unit").notNull(),
  populationReference: integer("population_reference"),
  
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
}, (table) => ({
  stateIdx: index("ind_state_idx").on(table.stateCode),
  cityIdx: index("ind_city_idx").on(table.municipalityCode),
  periodIdx: index("ind_period_idx").on(table.period),
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
  geom: geometry("geom", { type: "MultiPolygon", mode: "xy", srid: 4326 }), // Polygons
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
});

export const geographicMunicipalities = pgTable("geographic_municipalities", {
  code: text("code").primaryKey(), // IBGE code (7 digits)
  stateCode: text("state_code").notNull(), // Links to geographicStates.code
  stateAcronym: text("state_acronym").notNull(), // e.g. SP
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(), // no accents, lowercase for searching
  population: integer("population"), // From census/estimativas
  latitude: doublePrecision("latitude"), // Centroid
  longitude: doublePrecision("longitude"), // Centroid
  geom: geometry("geom", { type: "MultiPolygon", mode: "xy", srid: 4326 }), // Polygons
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: true }).notNull(),
}, (table) => ({
  stateIdx: index("muni_state_idx").on(table.stateAcronym),
  normNameIdx: index("muni_norm_name_idx").on(table.normalizedName),
  geomIdx: index("muni_geom_idx").using("gist", table.geom),
}));
