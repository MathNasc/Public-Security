import { db } from '../db/index.js';
import { securityOccurrences, dataSources, dataImports } from '../db/schema.js';
import { eq } from "drizzle-orm";
import { GeocodingService } from './GeocodingService.js';
import { RawCrimeRecord } from '../ingestion/ssp/normalizer.js';

export class DataIngestionService {
  static async ingestData(
    sourceName: string, 
    records: RawCrimeRecord[],
    sourceInfo: { provider: string, url: string, description: string, coverage: string, filename?: string, batchId?: string }
  ) {
    console.log(`Starting ingestion for ${sourceName} - ${records.length} records`);
    
    const batchId = sourceInfo.batchId || crypto.randomUUID();
    
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
      const existing = await db.query.securityOccurrences.findMany({
        columns: { sourceRecordId: true },
        where: (occ, { eq, and, inArray }) => and(
          eq(occ.sourceId, sourceName),
          inArray(occ.sourceRecordId, sourceIds)
        )
      });
      const existingIds = new Set(existing.map(e => e.sourceRecordId));

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
          sourceId: sourceName,
          sourceRecordId: r.source_record_id,
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
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      if (valuesToInsert.length > 0) {
        await db.insert(securityOccurrences).values(valuesToInsert).onConflictDoNothing({ target: [securityOccurrences.sourceId, securityOccurrences.sourceRecordId] });
      }
    }

    console.log(`Finished ingestion. Inserted ${stats.valid_records} valid records.`);
    
    // Save Batch Stats
    const existingBatch = await db.query.dataImports.findFirst({ where: (di, { eq }) => eq(di.id, batchId) });
    if (existingBatch) {
      await db.update(dataImports).set({
        recordsInserted: (existingBatch.recordsInserted || 0) + stats.valid_records,
        recordsRejected: (existingBatch.recordsRejected || 0) + stats.rejected_records,
        finishedAt: new Date()
      }).where(eq(dataImports.id, batchId));
    } else {
      await db.insert(dataImports).values({
      id: batchId,
      sourceId: sourceName,
      status: "SUCCESS",
      startedAt: new Date(),
      finishedAt: new Date(),
      recordsInserted: stats.valid_records,
      recordsRejected: stats.rejected_records,
      createdAt: new Date(),
    });
    }

    // Update Data Source Metadata
    const existingSource = await db.query.dataSources.findFirst({
      where: (ds, { eq }) => eq(ds.name, sourceName)
    });
    
    if (existingSource) {
      await db.update(dataSources).set({
        lastAttempt: new Date(),
        recordsImported: (existingSource.recordsImported || 0) + stats.valid_records,
        status: "Ativo",
        updatedAt: new Date()
      }).where(eq(dataSources.id, existingSource.id));
    } else {
      await db.insert(dataSources).values({
        id: crypto.randomUUID(),
        name: sourceName,
        provider: sourceInfo.provider,
        description: sourceInfo.description,
        url: sourceInfo.url,
        coverage: sourceInfo.coverage,
        lastAttempt: new Date(),
        recordsImported: stats.valid_records,
        status: "Ativo",
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return { inserted: stats.valid_records, stats, batchId };
  }
}
