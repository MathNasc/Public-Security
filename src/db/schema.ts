import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  formattedAddress: text("formatted_address").notNull(),
  street: text("street"),
  number: text("number"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(),
  sourceName: text("source_name").notNull(),
  filename: text("filename"),
  totalRecords: integer("total_records").notNull(),
  validRecords: integer("valid_records").notNull(),
  rejectedRecords: integer("rejected_records").notNull(),
  withCoordinates: integer("with_coordinates").notNull(),
  withoutCoordinates: integer("without_coordinates").notNull(),
  duplicates: integer("duplicates").notNull(),
  geocoded: integer("geocoded").notNull(),
  startedAt: integer("started_at", { mode: 'timestamp' }).notNull(),
  completedAt: integer("completed_at", { mode: 'timestamp' }),
});

export const geocodingCache = sqliteTable("geocoding_cache", {
  id: text("id").primaryKey(),
  normalizedAddress: text("normalized_address").notNull().unique(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  precision: text("precision").notNull(), // exact, approximate
  provider: text("provider").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

export const occurrences = sqliteTable("occurrences", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  sourceId: text("source_id"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  occurredAt: integer("occurred_at", { mode: 'timestamp' }), // Nullable for records without date
  latitude: real("latitude"), // Nullable for records without coordinates
  longitude: real("longitude"), // Nullable for records without coordinates
  locationPrecision: text("location_precision"), // exact, approximate, neighborhood, unknown
  
  // Geocoding & Quality Tracking
  geocodingStatus: text("geocoding_status"), // original, geocoded, approximate, failed, not_enough_data
  geocodingProvider: text("geocoding_provider"),
  geocodingConfidence: text("geocoding_confidence"),
  geocodedAt: integer("geocoded_at", { mode: 'timestamp' }),
  originalAddress: text("original_address"),
  
  importBatchId: text("import_batch_id"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
}, (table) => ({
  latIdx: index("lat_idx").on(table.latitude),
  lonIdx: index("lon_idx").on(table.longitude),
  dateIdx: index("date_idx").on(table.occurredAt),
  sourceIdIdx: index("source_id_idx").on(table.source, table.sourceId),
  batchIdx: index("batch_idx").on(table.importBatchId),
}));

export const dataSources = sqliteTable("data_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider"),
  description: text("description"),
  url: text("url"),
  lastUpdatedAt: integer("last_updated_at", { mode: 'timestamp' }),
  recordsImported: integer("records_imported").default(0),
  coverage: text("coverage"),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
});

export const safetyAnalyses = sqliteTable("safety_analyses", {
  id: text("id").primaryKey(),
  locationId: text("location_id").notNull(),
  radiusMeters: integer("radius_meters").notNull(),
  periodStart: integer("period_start", { mode: 'timestamp' }).notNull(),
  periodEnd: integer("period_end", { mode: 'timestamp' }).notNull(),
  score: integer("score").notNull(),
  confidence: real("confidence").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});
