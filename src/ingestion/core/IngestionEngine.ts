import { db } from '../../db/index';
import { dataImports, securityOccurrences, securityIndicators, dataSources } from '../../db/schema';
import { SecurityDataSource, NormalizedRecord } from './types';
import { eq } from 'drizzle-orm';

export class IngestionEngine {
  
  async runJob(source: SecurityDataSource) {
    console.log(`[INGESTION ENGINE] Starting job for source: ${source.id} (${source.name})`);
    
    // Create or update DataSource in DB
    const existingSource = await db.query.dataSources.findFirst({
      where: (ds, { eq }) => eq(ds.id, source.id)
    });

    if (!existingSource) {
      await db.insert(dataSources).values({
        id: source.id,
        name: source.name,
        provider: source.provider,
        country: source.country,
        state: source.state,
        updateFrequency: source.update_frequency,
        status: 'OPERATIONAL',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      await db.update(dataSources).set({ lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
    }

    try {
      // 1. DISCOVER
      console.log(`[INGESTION ENGINE] Discovering datasets...`);
      const datasets = await source.discover();
      console.log(`[INGESTION ENGINE] Found ${datasets.length} datasets.`);
      
      for (const dataset of datasets) {
        console.log(`[INGESTION ENGINE] Processing dataset: ${dataset.name}`);
        
        // Setup Import Log
        const importId = crypto.randomUUID();
        await db.insert(dataImports).values({
          id: importId,
          sourceId: source.id,
          datasetId: dataset.id,
          startedAt: new Date(),
          status: 'IN_PROGRESS',
          createdAt: new Date()
        });
        
        let stats = {
          recordsDownloaded: 0,
          recordsParsed: 0,
          recordsInserted: 0,
          recordsUpdated: 0,
          recordsRejected: 0
        };

        try {
          // 2. DOWNLOAD
          const rawData = await source.fetch(dataset);
          
          // 3. PARSE
          const normalizedRecords = await source.parse(rawData);
          stats.recordsDownloaded = normalizedRecords.length;
          stats.recordsParsed = normalizedRecords.length;
          console.log(`[INGESTION ENGINE] Parsed ${normalizedRecords.length} records.`);
          
          // 4. VALIDATE
          const validation = await source.validate(normalizedRecords);
          stats.recordsRejected = validation.rejected_records;
          console.log(`[INGESTION ENGINE] Validation: ${validation.valid_records} valid, ${validation.rejected_records} rejected.`);
          
          if (validation.valid_records > 0) {
            // 5. UPSERT (DEDUPLICATE & INSERT)
            const validRecords = normalizedRecords.filter(r => r.category && r.source_record_id);
            
            // Process in chunks
            const CHUNK_SIZE = 500;
            
            for (let i = 0; i < validRecords.length; i += CHUNK_SIZE) {
              const chunk = validRecords.slice(i, i + CHUNK_SIZE);
              
              // Segregate Indicators vs Occurrences
              const occurrencesChunk = chunk.filter(c => !c.is_aggregated_indicator);
              const indicatorsChunk = chunk.filter(c => c.is_aggregated_indicator);
              
              if (occurrencesChunk.length > 0) {
                // SQLite Insert OR Ignore for Occurrences
                // A better approach would be proper UPSERT (ON CONFLICT DO UPDATE) but OR IGNORE is safe for immutable records.
                const occValues = occurrencesChunk.map(r => ({
                  id: crypto.randomUUID(),
                  sourceId: source.id,
                  datasetId: dataset.id,
                  sourceRecordId: r.source_record_id,
                  country: r.country,
                  stateCode: r.state_code,
                  municipalityCode: r.municipality_code,
                  category: r.category,
                  subcategory: r.subcategory,
                  occurredAt: r.occurred_at ? new Date(r.occurred_at) : null,
                  latitude: r.latitude,
                  longitude: r.longitude,
                  locationPrecision: r.location_precision,
                  originalAddress: r.original_address,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }));
                
                try {
                  // We simulate INSERT OR IGNORE via raw query or relying on unique constraints (caught locally)
                  // For Drizzle SQLite, insert or ignore:
                  await db.insert(securityOccurrences).values(occValues).onConflictDoNothing({ target: [securityOccurrences.sourceId, securityOccurrences.sourceRecordId] });
                  stats.recordsInserted += occurrencesChunk.length; // Approximate stats for MVP
                } catch(e) { console.error("Error inserting occurrence chunk", e); }
              }
              
              if (indicatorsChunk.length > 0) {
                const indValues = indicatorsChunk.map(r => ({
                  id: crypto.randomUUID(),
                  sourceId: source.id,
                  datasetId: dataset.id,
                  stateCode: r.state_code,
                  municipalityCode: r.municipality_code,
                  category: r.category,
                  subcategory: r.subcategory,
                  period: r.period_reference || 'unknown',
                  value: r.value || 0,
                  unit: 'occurrences',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }));
                
                try {
                  await db.insert(securityIndicators).values(indValues).onConflictDoNothing({ target: [securityIndicators.sourceId, securityIndicators.stateCode, securityIndicators.municipalityCode, securityIndicators.category, securityIndicators.period] });
                  stats.recordsInserted += indicatorsChunk.length;
                } catch(e) { console.error("Error inserting indicator chunk", e); }
              }
            }
          }
          
          // 6. UPDATE METRICS
          await db.update(dataImports).set({
            status: 'SUCCESS',
            finishedAt: new Date(),
            recordsDownloaded: stats.recordsDownloaded,
            recordsParsed: stats.recordsParsed,
            recordsInserted: stats.recordsInserted,
            recordsRejected: stats.recordsRejected
          }).where(eq(dataImports.id, importId));

        } catch (datasetError: any) {
          console.error(`[INGESTION ENGINE] Dataset ${dataset.id} failed:`, datasetError);
          await db.update(dataImports).set({
            status: 'FAILED',
            finishedAt: new Date(),
            errorMessage: datasetError.message
          }).where(eq(dataImports.id, importId));
        }
      }
      
      await db.update(dataSources).set({ 
        status: 'OPERATIONAL', 
        lastSuccessfulImport: new Date(),
        updatedAt: new Date()
      }).where(eq(dataSources.id, source.id));

      console.log(`[INGESTION ENGINE] Job finished successfully for ${source.id}`);
    } catch (error: any) {
      console.error(`[INGESTION ENGINE] Job failed for source ${source.id}:`, error);
      await db.update(dataSources).set({ 
        status: 'FAILING', 
        errorMessage: error.message,
        updatedAt: new Date()
      }).where(eq(dataSources.id, source.id));
    }
  }
}
