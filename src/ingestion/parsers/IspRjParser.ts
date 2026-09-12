import { BaseParser } from './BaseParser.js';
import { db } from '../../db/index.js';
import { securityOccurrences } from '../../db/schema.js';
import fs from 'fs';
import readline from 'readline';
import crypto from 'crypto';

export class IspRjParser extends BaseParser {
  protected getExpectedHeaders(): string[] { return []; }
  protected async parseRow(row: any): Promise<any> { return null; }

  async process(jobId: string, rawFilePath: string, datasetId: string): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
    try {
      console.log(`[IspRjParser] Iniciando parsing do CSV: ${rawFilePath}`);
      
      const fileStream = fs.createReadStream(rawFilePath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let recordsProcessed = 0;
      let batch = [];
      let isFirstLine = true;
      let headers: string[] = [];
      
      for await (const line of rl) {
        // ISP-RJ often uses semicolons
        const cols = line.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
        
        if (isFirstLine) {
          headers = cols.map(h => h.toLowerCase());
          isFirstLine = false;
          continue;
        }

        if (cols.length < 5) continue; // Empty or invalid line

        // ISP-RJ variables typical (fmun, ano, mes, hom_doloso, roubo_veiculo...)
        // We'll extract a few core ones mapped to columns for our simple map prototype.
        const getCol = (name: string) => {
          const idx = headers.indexOf(name);
          return idx >= 0 ? cols[idx] : null;
        };

        const ano = parseInt(getCol('ano') || '2024');
        const mes = parseInt(getCol('mes') || '1');
        const fmun = getCol('fmun'); // Municipality name

        const metrics = [
          { cat: 'cvli', name: 'hom_doloso', val: parseInt(getCol('hom_doloso') || '0') },
          { cat: 'cvli', name: 'latrocinio', val: parseInt(getCol('latrocinio') || '0') },
          { cat: 'cvp', name: 'roubo_veiculo', val: parseInt(getCol('roubo_veiculo') || '0') },
          { cat: 'cvp', name: 'roubo_transeunte', val: parseInt(getCol('roubo_transeunte') || '0') },
          { cat: 'violencia_mulher', name: 'estupro', val: parseInt(getCol('estupro') || '0') }
        ];

        for (const metric of metrics) {
          if (metric.val > 0) {
            batch.push({
              id: crypto.randomUUID(),
              sourceId: 'ISP-RJ',
              datasetId,
              stateCode: 'RJ',
              municipalityName: fmun ? fmun.toUpperCase() : null,
              category: metric.cat,
              sourceCategory: metric.name,
              occurredAt: new Date(ano, mes - 1, 1),
              year: ano,
              month: mes,
              latitude: null,
              longitude: null,
              isSyntheticPoint: false,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
        
        if (batch.length >= 500) {
          await db.insert(securityOccurrences).values(batch);
          recordsProcessed += batch.length;
          batch = [];
        }
      }

      if (batch.length > 0) {
        await db.insert(securityOccurrences).values(batch);
        recordsProcessed += batch.length;
      }
      
      console.log(`[IspRjParser] Concluído. ${recordsProcessed} registros inseridos.`);
      return { success: true, recordsProcessed };
    } catch (e) {
      console.error(`[IspRjParser] Falha:`, e);
      return { success: false, recordsProcessed: 0, error: e.message };
    }
  }
}
