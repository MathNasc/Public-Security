import { BaseParser } from './BaseParser.js';
import { db } from '../../db/index.js';
import { securityOccurrences } from '../../db/schema.js';
import fs from 'fs';
import readline from 'readline';
import crypto from 'crypto';
import xlsx from 'xlsx';
import { CanonicalCategory } from '../../services/Taxonomy.js';

export class BaParser extends BaseParser {
  protected getExpectedHeaders(): string[] { return []; }
  protected async parseRow(row: any): Promise<any> { return null; }

  async process(jobId: string, rawFilePath: string, datasetId: string): Promise<{ success: boolean; recordsProcessed: number; error?: string }> {
    try {
      console.log(`[BaParser] Iniciando parsing do arquivo BA: ${rawFilePath}`);
      
      let recordsProcessed = 0;
      let batch = [];
      const isXlsx = rawFilePath.toLowerCase().endsWith('.xlsx') || rawFilePath.toLowerCase().endsWith('.xls');

      if (isXlsx) {
         // Process XLSX (Usually aggregate data)
         const wb = xlsx.read(fs.readFileSync(rawFilePath), { type: 'buffer' });
         const sheet = wb.Sheets[wb.SheetNames[0]];
         const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
         
         let headers: string[] = [];
         let foundHeader = false;

         for (const row of data) {
            if (!row || row.length === 0) continue;
            
            // Look for header row
            if (!foundHeader) {
               if (row.some(c => typeof c === 'string' && c.toUpperCase().includes('MUNIC'))) {
                  headers = row.map(c => typeof c === 'string' ? c.toUpperCase().trim() : '');
                  foundHeader = true;
               }
               continue;
            }

            // Process data row
            const getCol = (name: string) => {
               const idx = headers.findIndex(h => h.includes(name));
               return idx >= 0 ? row[idx] : null;
            };

            const muni = getCol('MUNIC');
            if (!muni || String(muni).trim() === '') continue;

            const crimes = [
               { cat: 'vehicle_theft' as CanonicalCategory, col: 'FURTO DE VEÍCULO', val: getCol('FURTO DE VEÍCULO') },
               { cat: 'robbery' as CanonicalCategory, col: 'ROUBO A TRANSEUNTE', val: getCol('ROUBO A TRANSEUNTE') },
               { cat: 'vehicle_robbery' as CanonicalCategory, col: 'ROUBO DE VEÍCULO', val: getCol('ROUBO DE VEÍCULO') },
               { cat: 'sexual_crime' as CanonicalCategory, col: 'ESTUPRO', val: getCol('ESTUPRO') },
               { cat: 'homicide' as CanonicalCategory, col: 'TENTATIVA DE HOMICIDIO', val: getCol('TENTATIVA DE HOMICIDIO') }
            ];

            for (const crime of crimes) {
               const valNum = parseInt(String(crime.val || '0').replace(/\D/g, ''));
               if (valNum > 0) {
                  // We simulate multiple records or just one record with value count?
                  // For occurrences, we create valNum rows if it's microdata format, 
                  // but for aggregate we can insert individual rows to preserve count.
                  for (let i = 0; i < valNum; i++) {
                     batch.push({
                        id: crypto.randomUUID(),
                        sourceId: 'SSP-BA',
                        datasetId,
                        stateCode: 'BA',
                        municipalityName: String(muni).toUpperCase(),
                        category: crime.cat,
                        sourceCategory: crime.col,
                        occurredAt: new Date(2024, 0, 1), 
                        year: 2024,
                        month: 1,
                        createdAt: new Date(),
                        updatedAt: new Date()
                     });
                     if (batch.length >= 10) {
                        await db.insert(securityOccurrences).values(batch).onConflictDoNothing();
                        recordsProcessed += batch.length;
                        batch = [];
                     }
                  }
               }
            }

            if (batch.length >= 10) {
               await db.insert(securityOccurrences).values(batch).onConflictDoNothing();
               recordsProcessed += batch.length;
               batch = [];
            }
         }
      } else {
         // Process CSV (Usually microdata)
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

            const delito = getCol('DELITO');
            if (!delito) continue;

            const dateStr = getCol('DATA_FATO');
            const muni = getCol('MUNICIPIO FATO');
            let occurredAt = new Date();
            let year = new Date().getFullYear();
            let month = new Date().getMonth() + 1;

            if (dateStr) {
               const parsedDate = new Date(dateStr);
               if (!isNaN(parsedDate.getTime())) {
                  occurredAt = parsedDate;
                  year = parsedDate.getFullYear();
                  month = parsedDate.getMonth() + 1;
               }
            }

            let cat: CanonicalCategory = 'other';
            const delLower = delito.toLowerCase();
            if (delLower.includes('homic')) cat = 'homicide';
            else if (delLower.includes('roubo') || delLower.includes('veiculo')) cat = 'vehicle_robbery';
            else if (delLower.includes('estupro')) cat = 'sexual_crime';

            batch.push({
               id: crypto.randomUUID(),
               sourceId: 'SSP-BA',
               datasetId,
               stateCode: 'BA',
               municipalityName: muni ? muni.toUpperCase() : null,
               category: cat,
               sourceCategory: delito,
               occurredAt,
               year,
               month,
               latitude: getCol('LATITUDE') ? parseFloat(getCol('LATITUDE').replace(',', '.')) : null,
               longitude: getCol('LONGITUDE') ? parseFloat(getCol('LONGITUDE').replace(',', '.')) : null,
               isSyntheticPoint: false,
               createdAt: new Date(),
               updatedAt: new Date()
            });

            if (batch.length >= 10) {
               await db.insert(securityOccurrences).values(batch).onConflictDoNothing();
               recordsProcessed += batch.length;
               batch = [];
            }
         }
      }

      if (batch.length > 0) {
        await db.insert(securityOccurrences).values(batch).onConflictDoNothing();
        recordsProcessed += batch.length;
      }
      
      console.log(`[BaParser] Concluído. ${recordsProcessed} registros inseridos.`);
      return { success: true, recordsProcessed };
    } catch (e) {
      console.error(`[BaParser] Falha:`, e);
      return { success: false, recordsProcessed: 0, error: e.message };
    }
  }
}
