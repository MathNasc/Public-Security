import { BaseParser } from './BaseParser.js';
import { db } from '../../db/index.js';
import { securityIndicators } from '../../db/schema.js';
import fs from 'fs';
import readline from 'readline';
import crypto from 'crypto';
import { CanonicalCategory } from '../../services/Taxonomy.js';

export class RsParser extends BaseParser {
  protected getExpectedHeaders(): string[] { return []; }
  protected async parseRow(row: any): Promise<any> { return null; }
  
  async process(jobId: string, rawFilePath: string, datasetId: string): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
    try {
      console.log(`[RsParser] Iniciando parsing do arquivo RS: ${rawFilePath}`);
      
      let recordsProcessed = 0;
      let batch = [];
      const fileStream = fs.createReadStream(rawFilePath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      let isFirstLine = true;
      let headers: string[] = [];
      
      for await (const line of rl) {
        const cols = line.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
        if (isFirstLine) {
          headers = cols.map(h => h.toLowerCase());
          isFirstLine = false;
          continue;
        }
        if (cols.length < 5) continue;
        
        const getCol = (name: string) => {
          const idx = headers.indexOf(name);
          return idx >= 0 ? cols[idx] : null;
        };
        
        const ibge = getCol('cod_ibge');
        if (!ibge) continue;
        
        const ano = parseInt(getCol('ano') || '2024');
        const mes = parseInt(getCol('mes') || '1');
        
        const periodStr = `${ano}-${String(mes).padStart(2, '0')}`;
        
        const metrics = [
          { cat: 'cvli', name: 'homicidio_doloso' },
          { cat: 'cvli', name: 'latrocinio' },
          { cat: 'cvli', name: 'feminicidio' },
          { cat: 'cvp', name: 'roubo_veiculo' },
          { cat: 'cvp', name: 'furto_veiculo' },
          { cat: 'cvp', name: 'roubo' },
          { cat: 'cvp', name: 'furto' },
          { cat: 'violencia_mulher', name: 'estupro' },
          { cat: 'drogas_armas', name: 'trafico_entorpecentes' },
          { cat: 'drogas_armas', name: 'delitos_armas_municoes' }
        ];
        
        for (const metric of metrics) {
          const valStr = getCol(metric.name);
          if (valStr && valStr !== '0' && valStr !== '') {
            const val = parseInt(valStr);
            if (val > 0) {
              batch.push({
                id: crypto.randomUUID(),
                sourceId: 'SSP-RS',
                datasetId,
                stateCode: 'RS',
                municipalityCode: ibge,
                category: metric.cat,
                sourceCategory: metric.name,
                subcategory: metric.name,
                period: periodStr,
                value: val,
                unit: 'occurrences',
                granularity: 'municipality',
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          }
        }
        
        if (batch.length >= 10) {
          await db.insert(securityIndicators).values(batch).onConflictDoNothing();
          recordsProcessed += batch.length;
          batch = [];
        }
      }
      
      if (batch.length > 0) {
        await db.insert(securityIndicators).values(batch).onConflictDoNothing();
        recordsProcessed += batch.length;
      }
      
      console.log(`[RsParser] Concluído. ${recordsProcessed} indicadores inseridos.`);
      return { success: true, recordsProcessed };
    } catch (e: any) {
      console.error(`[RsParser] Falha:`, e);
      return { success: false, recordsProcessed: 0, error: e.message };
    }
  }
}
