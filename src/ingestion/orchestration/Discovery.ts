import { db } from '../../db/index.js';
import { dataDatasets } from '../../db/schema.js';

export class Discovery {
  static async checkForUpdates(dataset: any): Promise<{ version: string; metadata?: any } | null> {
    // Determine the discovery strategy based on dataset sourceId or format
    console.log(`[Discovery] Checking ${dataset.name} for updates...`);
    
    try {
      if (dataset.sourceId === 'SSP-SP') {
        return this.checkSspSp(dataset);
      } else if (dataset.sourceId === 'SINESP') {
        return this.checkSinesp(dataset);
      } else {
        // Nenhuma simulação artificial: sem endpoint oficial implementado, retorna null
        return null;
      }
      return null;
    } catch (e: any) {
      console.error(`[Discovery] Error checking ${dataset.id}:`, e.message);
      return null;
    }
  }

  private static async checkSspSp(dataset: any) {
    // Emulate checking SSP-SP page for new monthly spreadsheet
    const version = new Date().toISOString().substring(0, 7);
    if (dataset.lastVersion !== version) {
      return { version };
    }
    return null;
  }

  private static async checkSinesp(dataset: any) {
    // SINESP automated discovery is blocked: dados.mj.gov.br was decommissioned,
    // and dados.gov.br requires Bearer authentication / gov.br WAF blocks scripts.
    console.warn(`[Discovery] SINESP automated discovery is BLOCKED. Remote portal dados.mj.gov.br is decommissioned and dados.gov.br requires Bearer authentication. Manual file ingestion is required.`);
    return null;
  }
}
