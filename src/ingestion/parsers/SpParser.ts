import { BaseParser } from './BaseParser.js';
import { db } from '../../db/index.js';
import { securityOccurrences } from '../../db/schema.js';
import fs from 'fs';
import readline from 'readline';
import crypto from 'crypto';

export class SpParser extends BaseParser {
  protected getExpectedHeaders(): string[] { return []; }
  protected async parseRow(row: any): Promise<any> { return null; }
  
  async process(jobId: string, rawFilePath: string, datasetId: string): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
    try {
      console.log(`[SpParser] Iniciando parsing do arquivo SP: ${rawFilePath}`);
      
      let recordsProcessed = 0;
      let batch = [];
      const fileStream = fs.createReadStream(rawFilePath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      let isFirstLine = true;
      let headers: string[] = [];
      
      for await (const line of rl) {
        const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (isFirstLine) {
          headers = cols.map(h => h.toUpperCase());
          isFirstLine = false;
          continue;
        }
        if (cols.length < 5) continue;
        
        const getCol = (name: string) => {
          const idx = headers.indexOf(name);
          return idx >= 0 ? cols[idx] : null;
        };
        
        const numBo = getCol('NUM_BO');
        if (!numBo) continue;
        
        const ano = parseInt(getCol('ANO_BO') || '2024');
        const dataStr = getCol('DATAOCORRENCIA') || '';
        const horaStr = getCol('HORAOCORRENCIA') || '';
        const cidade = getCol('CIDADE');
        const latStr = getCol('LATITUDE');
        const lonStr = getCol('LONGITUDE');
        const natureza = getCol('NATUREZA_APURADA');
        
        let month = 1;
        let dt = new Date(ano, 0, 1);
        if (dataStr.includes('/')) {
            const parts = dataStr.split('/');
            if (parts.length === 3) {
                month = parseInt(parts[1]);
                dt = new Date(ano, month - 1, parseInt(parts[0]));
            }
        }
        
        let lat = parseFloat(latStr || '0');
        let lon = parseFloat(lonStr || '0');
        if (isNaN(lat) || lat === 0) lat = null;
        if (isNaN(lon) || lon === 0) lon = null;
        
        batch.push({
          id: crypto.randomUUID(),
          sourceId: 'SSP-SP',
          datasetId,
          sourceRecordId: numBo,
          stateCode: 'SP',
          municipalityName: cidade ? cidade.toUpperCase() : null,
          category: this.mapCategory(natureza || ''),
          sourceCategory: natureza,
          occurredAt: dt,
          year: ano,
          month: month,
          latitude: lat,
          longitude: lon,
          isSyntheticPoint: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        if (batch.length >= 10) {
          await db.insert(securityOccurrences).values(batch).onConflictDoNothing({ target: [securityOccurrences.sourceId, securityOccurrences.sourceRecordId] });
          recordsProcessed += batch.length;
          batch = [];
        }
      }
      
      if (batch.length > 0) {
        await db.insert(securityOccurrences).values(batch).onConflictDoNothing({ target: [securityOccurrences.sourceId, securityOccurrences.sourceRecordId] });
        recordsProcessed += batch.length;
      }
      
      console.log(`[SpParser] Concluído. ${recordsProcessed} registros inseridos.`);
      return { success: true, recordsProcessed };
    } catch (e: any) {
      console.error(`[SpParser] Falha:`, e);
      return { success: false, recordsProcessed: 0, error: e.message };
    }
  }
  
  private mapCategory(raw: string): string {
    const r = raw.toLowerCase();
    if (r.includes('homicídio') || r.includes('latrocínio') || r.includes('lesão corporal seguida de morte')) return 'cvli';
    if (r.includes('roubo') || r.includes('furto')) return 'cvp';
    if (r.includes('estupro')) return 'violencia_mulher';
    return 'other';
  }
}
