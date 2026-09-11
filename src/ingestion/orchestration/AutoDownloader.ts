import { db } from '../../db/index.js';
import { dataSources } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import axios from 'axios';

export class AutoDownloader {
  static async triggerAll() {
    console.log("[AutoDownloader] Verificando links oficiais (sem gerar dados falsos)...");
    const sources = await db.select().from(dataSources);
    
    let processed = 0;
    for (const source of sources) {
      if (!source.url) continue;
      
      try {
        // Tenta acessar a URL (timeout de 3s para nao travar)
        const res = await axios.head(source.url, { timeout: 3000 });
        if (res.status >= 200 && res.status < 400) {
           await db.update(dataSources).set({ status: 'SUCCESS', errorMessage: null, lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
        } else {
           await db.update(dataSources).set({ status: 'PARTIAL', errorMessage: `HTTP ${res.status}`, lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
        }
      } catch (e) {
        // Marca como falha real se o link estiver quebrado/404
        await db.update(dataSources).set({ status: 'FAILED', errorMessage: e.message || 'Link quebrado', lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
      }
      processed++;
    }
    return processed;
  }
}
