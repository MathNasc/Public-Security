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
        // Tenta acessar a URL (timeout de 15s para nao travar, servidores do governo sao lentos)
        let res;
        try {
           res = await axios.head(source.url, { timeout: 15000 });
        } catch (headErr) {
           // Se der erro no HEAD (ex: 405 Method Not Allowed ou 403 Forbidden que alguns bloqueiam), tenta GET básico
           if (headErr.response && (headErr.response.status === 405 || headErr.response.status === 403)) {
               res = await axios.get(source.url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
           } else {
               throw headErr;
           }
        }
        
        if (res.status >= 200 && res.status < 400) {
           await db.update(dataSources).set({ status: 'SUCCESS', errorMessage: null, lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
        } else {
           await db.update(dataSources).set({ status: 'PARTIAL', errorMessage: `HTTP ${res.status}`, lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
        }
      } catch (e: any) {
        // Marca como falha real se o link estiver quebrado/404
        await db.update(dataSources).set({ status: 'FAILED', errorMessage: e.message || 'Link quebrado', lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
      }
      processed++;
    }
    return processed;
  }
}
