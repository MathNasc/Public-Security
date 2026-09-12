import { db } from '../../db/index.js';
import { ingestionJobs, dataImports } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { SinespParser } from '../parsers/SinespParser.js';
import { IspRjParser } from '../parsers/IspRjParser.js';
import { BaParser } from '../parsers/BaParser.js';
import { CeParser } from '../parsers/CeParser.js';

export class IngestionWorker {
  async processPendingJobs() {
    console.log('[IngestionWorker] Buscando trabalhos pendentes...');
    
    // Find a pending job
    const pendingJobs = await db.select()
      .from(dataImports)
      .where(eq(dataImports.status, 'pending'))
      .limit(1);
      
    if (pendingJobs.length === 0) {
      console.log('[IngestionWorker] Nenhum trabalho pendente.');
      return;
    }
    
    const job = pendingJobs[0];
    console.log(`[IngestionWorker] Processando Job ${job.id} (Dataset: ${job.datasetId})`);
    
    // Mark as processing
    await db.update(dataImports)
      .set({ status: 'processing', processingStartedAt: new Date() })
      .where(eq(dataImports.id, job.id));
      
    try {
      let result;
      // Route to correct parser based on source or dataset
      if (job.sourceId === 'SINESP') {
        const parser = new SinespParser();
        result = await parser.process(job.id, job.rawFilePath, job.datasetId);
      } else if (job.sourceId === 'ISP-RJ') {
        const parser = new IspRjParser();
        result = await parser.process(job.id, job.rawFilePath, job.datasetId);
      } else if (job.sourceId === 'SSP-BA') {
        const parser = new BaParser();
        result = await parser.process(job.id, job.rawFilePath, job.datasetId);
      } else if (job.sourceId === 'SSPDS-CE') {
        const parser = new CeParser();
        result = await parser.process(job.id, job.rawFilePath, job.datasetId);
      } else {
        throw new Error(`Nenhum parser configurado para a origem: ${job.sourceId}`);
      }
      
      if (result.success) {
        await db.update(dataImports)
          .set({ 
            status: 'completed', 
            processingCompletedAt: new Date(),
            recordsImported: result.recordsProcessed,
            errorMessage: null
          })
          .where(eq(dataImports.id, job.id));
        console.log(`[IngestionWorker] Job ${job.id} concluído com sucesso. Registros inseridos: ${result.recordsProcessed}`);
      } else {
        throw new Error(result.error || 'Erro desconhecido no parser');
      }
      
    } catch (e) {
      console.error(`[IngestionWorker] Falha no Job ${job.id}:`, e);
      await db.update(dataImports)
        .set({ 
          status: 'failed', 
          processingCompletedAt: new Date(),
          errorMessage: e.message
        })
        .where(eq(dataImports.id, job.id));
    }
  }
}
