import { db } from "../db/index.js";
import { occurrences, dataSources, importBatches } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { GeocodingService } from "./GeocodingService.js";
import { RawCrimeRecord } from "../ingestion/ssp/normalizer.js";

export class DataIngestionService {
  static async ingestData(
    sourceName: string, 
    records: RawCrimeRecord[],
    sourceInfo: { provider: string, url: string, description: string, coverage: string, filename?: string }
  ) {
    console.log(`Starting ingestion for ${sourceName} - ${records.length} records`);
    
    const batchId = crypto.randomUUID();
    
    let stats = {
      total_records: records.length,
      valid_records: 0,
      rejected_records: 0,
      with_coordinates: 0,
      without_coordinates: 0,
      duplicates: 0,
      geocoded: 0,
    };

    // Process in chunks to avoid SQLite limits
    const CHUNK_SIZE = 500;
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const valuesToInsert: any[] = [];
      
      // 1. Fetch existing SourceIDs to find duplicates
      const sourceIds = chunk.map(r => r.source_record_id);
      const existing = await db.query.occurrences.findMany({
        columns: { sourceId: true },
        where: (occ, { eq, and, inArray }) => and(
          eq(occ.source, sourceName),
          inArray(occ.sourceId, sourceIds)
        )
      });
      const existingIds = new Set(existing.map(e => e.sourceId));

      for (const r of chunk) {
        if (existingIds.has(r.source_record_id)) {
          stats.duplicates++;
          continue;
        }

        // Validity check (must have category and source_id)
        if (!r.source_record_id || !r.category) {
          stats.rejected_records++;
          continue;
        }
        
        stats.valid_records++;
        
        let lat = r.latitude;
        let lon = r.longitude;
        let precision = r.location_precision;
        let geoStatus = 'original';
        let geoProvider = null;
        let geoConf = null;
        let geocodedAt = null;

        if (lat !== null && lon !== null) {
          stats.with_coordinates++;
        } else {
          stats.without_coordinates++;
          // Try geocoding
          if (r.original_address) {
            const geoRes = await GeocodingService.geocode(r.original_address);
            if (geoRes) {
              lat = geoRes.latitude;
              lon = geoRes.longitude;
              precision = geoRes.precision;
              geoStatus = 'geocoded';
              geoProvider = geoRes.provider;
              geocodedAt = new Date();
              stats.geocoded++;
            } else {
              geoStatus = 'failed'; // We tried but failed
            }
          } else {
            geoStatus = 'not_enough_data'; // No address to even try
          }
        }

        valuesToInsert.push({
          id: crypto.randomUUID(),
          source: sourceName,
          sourceId: r.source_record_id,
          category: r.category,
          subcategory: r.subcategory,
          occurredAt: r.occurred_at ? new Date(r.occurred_at) : null,
          latitude: lat,
          longitude: lon,
          locationPrecision: precision,
          geocodingStatus: geoStatus,
          geocodingProvider: geoProvider,
          geocodingConfidence: geoConf,
          geocodedAt: geocodedAt,
          originalAddress: r.original_address,
          importBatchId: batchId,
          createdAt: new Date(),
        });
      }

      if (valuesToInsert.length > 0) {
        await db.insert(occurrences).values(valuesToInsert);
      }
    }

    console.log(`Finished ingestion. Inserted ${stats.valid_records} valid records.`);
    
    // Save Batch Stats
    await db.insert(importBatches).values({
      id: batchId,
      sourceName: sourceName,
      filename: sourceInfo.filename || null,
      totalRecords: stats.total_records,
      validRecords: stats.valid_records,
      rejectedRecords: stats.rejected_records,
      withCoordinates: stats.with_coordinates,
      withoutCoordinates: stats.without_coordinates,
      duplicates: stats.duplicates,
      geocoded: stats.geocoded,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    // Update Data Source Metadata
    const existingSource = await db.query.dataSources.findFirst({
      where: (ds, { eq }) => eq(ds.name, sourceName)
    });
    
    if (existingSource) {
      await db.update(dataSources).set({
        lastUpdatedAt: new Date(),
        recordsImported: (existingSource.recordsImported || 0) + stats.valid_records,
        status: "Ativo",
      }).where(eq(dataSources.id, existingSource.id));
    } else {
      await db.insert(dataSources).values({
        id: crypto.randomUUID(),
        name: sourceName,
        provider: sourceInfo.provider,
        description: sourceInfo.description,
        url: sourceInfo.url,
        coverage: sourceInfo.coverage,
        lastUpdatedAt: new Date(),
        recordsImported: stats.valid_records,
        status: "Ativo",
      });
    }

    return { inserted: stats.valid_records, stats, batchId };
  }
}
