import { db, queryClient } from '../../db/index.js';
import { dataImports, securityOccurrences } from '../../db/schema.js';
import { eq, and, sql, isNull } from 'drizzle-orm';
import { rawStorage } from './Storage.js';
import { parse } from 'csv-parse';
import { SspSpAdapter } from '../adapters/ssp/SspSpAdapter.js';
import { IspRjAdapter } from '../adapters/isp-rj/IspRjAdapter.js';
import { SspMgAdapter } from '../adapters/ssp-mg/SspMgAdapter.js';
import { SinespAdapter } from '../adapters/sinesp/SinespAdapter.js';
import { IspRjAdapter } from '../adapters/isp-rj/IspRjAdapter.js';
import { SspMgAdapter } from '../adapters/ssp-mg/SspMgAdapter.js';
import { SspMgAdapter } from '../adapters/ssp-mg/SspMgAdapter.js';
import { randomUUID } from 'crypto';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 2000;

export class IngestionWorker {
  private workerId = randomUUID();
  private muniCache: Map<string, string> = new Map();
  private isRunning = false;
  
  async start() {
    this.isRunning = true;
    console.log(`[Worker ${this.workerId}] Started`);
    while (this.isRunning) {
      const job = await this.claimJob();
      if (job) {
        await this.processJob(job);
      } else {
        await new Promise(r => setTimeout(r, 5000)); // Poll every 5 seconds
      }
    }
  }
  
  stop() {
    this.isRunning = false;
    console.log(`[Worker ${this.workerId}] Stopped`);
  }
  
  private async loadMuniCache() {
    if (this.muniCache.size > 0) return;

    const munis = await queryClient`SELECT code, state_acronym, normalized_name FROM geographic_municipalities`;
    for (const m of munis) {
      this.muniCache.set(m.state_acronym + '_' + m.normalized_name, m.code);
    }
  
  }

  private async claimJob() {
    // Basic PG advisory lock or atomic update to claim a job
    const result = await db.execute(sql`
      UPDATE data_imports
      SET status = 'PROCESSING',
          worker_id = ${this.workerId},
          locked_at = NOW(),
          started_at = COALESCE(started_at, NOW()),
          attempts = attempts + 1
      WHERE id = (
        SELECT id FROM data_imports
        WHERE status = 'QUEUED' 
           OR (status = 'PROCESSING' AND locked_at < NOW() - INTERVAL '30 minutes')
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *;
    `);
    
    if (result.length > 0) {
      return result[0];
    }
    return null;
  }
  
  private async processJob(job: any) {
    console.log(`[Worker ${this.workerId}] Processing Job: ${job.id}`);
    
    try {
      if (!job.raw_file_path || !rawStorage.exists(job.raw_file_path)) {
        throw new Error(`Raw file missing at ${job.raw_file_path}`);
      }

      // We will read as stream
      await this.loadMuniCache();
      const stream = rawStorage.get(job.raw_file_path);
      
      const parser = stream.pipe(parse({
        columns: true,
        delimiter: [';', ','],
        trim: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true
      }));

      let recordsRead = 0;
      // Note: for real checkpointing we could resume from `job.checkpoint`, 
      // but csv-parse doesn't skip perfectly unless we count rows. 
      // So we'll skip `recordsRead < checkpoint`.
      let checkpoint = job.checkpoint ? parseInt(job.checkpoint, 10) : 0;
      
      let batch: any[] = [];
      let metrics = {
        recordsRead: job.records_read || 0,
        recordsValid: job.records_valid || 0,
        recordsInvalid: job.records_invalid || 0,
        recordsDuplicate: job.records_duplicate || 0,
        recordsInserted: job.records_inserted || 0,
        recordsWithoutCoordinates: job.records_without_coordinates || 0
      };

      
      let adapter: any;
      if (job.source_id === 'SSP-SP') adapter = new SspSpAdapter();
      else if (job.source_id === 'SINESP') adapter = new SinespAdapter();
      else if (job.source_id === 'ISP-RJ') adapter = new IspRjAdapter();
      else if (job.source_id === 'SSP-MG') adapter = new SspMgAdapter();
      else throw new Error("Unknown adapter for source: " + job.source_id);

      for await (const row of parser) {
        recordsRead++; 
        if(recordsRead % 1000 === 0) console.log("Read:", recordsRead);
        
        if (recordsRead <= checkpoint) {
          continue; 
        }
        
        metrics.recordsRead++;
        
        try {
          let results = adapter.parseRow(row);
          if (!results) {
             metrics.recordsInvalid++;
             continue;
          }
          if (!Array.isArray(results)) results = [results];
          
          for (const result of results) {
            if (!result || !result.data) {
              metrics.recordsInvalid++;
              continue;
            }
            
            if (result.target === 'occurrences' && (!result.data.latitude || !result.data.longitude)) {
              metrics.recordsWithoutCoordinates++;
            }
            
            if (result.target === 'indicators' && result.data.municipalityName && !result.data.municipalityCode) {
              const normName = result.data.municipalityName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              const key = result.data.stateCode + '_' + normName;
              result.data.municipalityCode = this.muniCache.get(key) || null;
            }
            
            metrics.recordsValid++;
            batch.push(result);
            
            if (batch.length >= BATCH_SIZE) {
              await this.insertBatch(job.source_id, batch, metrics);
              batch = [];
              checkpoint = recordsRead;
              await this.saveProgress(job.id, checkpoint, metrics);
            }
          }
        } catch (err) {
           metrics.recordsInvalid++;
        }
      }
// Insert remaining
      if (batch.length > 0) {
        await this.insertBatch(job.source_id, batch, metrics);
        checkpoint = recordsRead;
      }
      
      // Finish job
      await db.execute(sql`
        UPDATE data_imports
        SET status = 'COMPLETED',
            finished_at = NOW(),
            checkpoint = ${checkpoint.toString()},
            records_read = ${metrics.recordsRead},
            records_valid = ${metrics.recordsValid},
            records_invalid = ${metrics.recordsInvalid},
            records_inserted = ${metrics.recordsInserted},
            records_without_coordinates = ${metrics.recordsWithoutCoordinates},
            records_duplicate = ${metrics.recordsDuplicate}
        WHERE id = ${job.id}
      `);
      console.log(`[Worker ${this.workerId}] Job Completed: ${job.id}`);
      
    } catch (error: any) {
      console.error(`[Worker ${this.workerId}] Job Failed: ${job.id}`, error);
      
      const newStatus = job.attempts >= MAX_ATTEMPTS ? 'FAILED' : 'QUEUED';
      await db.execute(sql`
        UPDATE data_imports
        SET status = ${newStatus},
            last_error = ${error.message},
            failed_at = NOW()
        WHERE id = ${job.id}
      `);
    }
  }
  
  private async insertBatch(sourceId: string, records: any[], metrics: any) {
    if (records.length === 0) return;
    const target = records[0].target;
    
    if (target === 'occurrences') {
      const valuesToInsert = records.map(r => r.data).map(r => ({
        id: r.id || randomUUID(),
        source_id: sourceId,
        source_record_id: r.source_record_id,
        category: r.category,
        subcategory: r.subcategory,
        source_category: r.sourceCategory,
        occurred_at: r.occurred_at,
        latitude: r.latitude || null,
        longitude: r.longitude || null,
        geom: (r.latitude && r.longitude) ? `SRID=4326;POINT(${r.longitude} ${r.latitude})` : null,
        address: r.address,
        neighborhood: r.neighborhood,
        city: r.city,
        state_code: r.state_code,
        custom_attributes: r.custom_attributes,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      try {
        await queryClient`
          INSERT INTO security_occurrences ${queryClient(valuesToInsert)}
          ON CONFLICT DO NOTHING
        `;
        metrics.recordsInserted += valuesToInsert.length;
      } catch (e) {
        throw e;
      }
    } else if (target === 'indicators') {
      const valuesToInsert = records.map(r => r.data).map(r => ({
        id: randomUUID(),
        source_id: r.sourceId,
        dataset_id: r.datasetId,
        state_code: r.stateCode,
        municipality_code: r.municipalityCode || "UNKNOWN",
        category: r.category,
        source_category: r.sourceCategory,
        period: r.period,
        value: r.value,
        unit: r.unit,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      try {
        await queryClient`
          INSERT INTO security_indicators ${queryClient(valuesToInsert)} ON CONFLICT (source_id, state_code, municipality_code, category, period) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `;
        metrics.recordsInserted += valuesToInsert.length;
      } catch (e) {
        throw e;
      }
    }
  }

  private async saveProgress(jobId: string, checkpoint: number, metrics: any) {
    await db.execute(sql`
      UPDATE data_imports
      SET checkpoint = ${checkpoint.toString()},
          records_read = ${metrics.recordsRead},
          records_valid = ${metrics.recordsValid},
          records_invalid = ${metrics.recordsInvalid},
          records_inserted = ${metrics.recordsInserted},
          records_without_coordinates = ${metrics.recordsWithoutCoordinates},
          records_duplicate = ${metrics.recordsDuplicate}
      WHERE id = ${jobId}
    `);
  }
}
