import { SinespDownloader } from '../ingestion/downloaders/sinesp_downloader.js';
import { IspRjDownloader } from '../ingestion/downloaders/isprj_downloader.js';
import { BaCrawler } from '../ingestion/pipeline/BaCrawler.js';
import { IngestionWorker } from '../ingestion/pipeline/IngestionWorker.js';
import { db } from '../db/index.js';
import { dataImports } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export class AutomationService {
  static async triggerAll() {
    console.log('[AutomationService] Iniciando processo completo de automação...');
    let messages = [];
    
    try {
      console.log('[AutomationService] [1/3] SINESP');
      await new SinespDownloader().run();
      messages.push('SINESP OK');
    } catch(e) {
      console.error('Erro SINESP:', e);
      messages.push('SINESP Error');
    }
    
    try {
      console.log('[AutomationService] [2/3] ISP-RJ');
      await new IspRjDownloader().run();
      messages.push('ISP-RJ OK');
    } catch(e) {
      console.error('Erro ISP-RJ:', e);
      messages.push('ISP-RJ Error');
    }
    
    try {
      console.log('[AutomationService] [3/3] SSP-BA');
      await new BaCrawler().run();
      messages.push('SSP-BA OK');
    } catch(e) {
      console.error('Erro SSP-BA:', e);
      messages.push('SSP-BA Error');
    }
    
    // Agora dispara o Worker em background para processar qualquer fila gerada
    setTimeout(async () => {
      console.log('[AutomationService] Disparando worker para processar a fila gerada...');
      const worker = new IngestionWorker();
      let pending = true;
      while (pending) {
        const pendingCount = await db.select().from(dataImports).where(eq(dataImports.status, 'pending')).limit(1);
        if (pendingCount.length === 0) {
          console.log('[AutomationWorker] Fila vazia. Finalizando processamento em background.');
          break;
        }
        try {
          await worker.processPendingJobs();
        } catch (e) {
          console.error('[AutomationWorker] Erro processando job:', e);
          break;
        }
      }
    }, 1000);
    
    return messages;
  }
}
