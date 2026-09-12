import { db } from '../src/db/index.js';
import { securityOccurrences } from '../src/db/schema.js';
import * as xlsx from 'xlsx';
import crypto from 'crypto';
import path from 'path';

async function run() {
  const filePath = path.join(process.cwd(), 'raw_storage/SINESP/v1/bancovde-2026.xlsx');
  console.log(`Lendo ${filePath}`);
  
  // Read in streaming / minimal mode
  const workbook = xlsx.readFile(filePath, { type: 'file', cellDates: true, dense: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  console.log('Sheet Name:', sheetName);
  const rows = xlsx.utils.sheet_to_json(sheet) as any[];
  
  console.log(`Total linhas: ${rows.length}. Inserindo apenas as 100 primeiras.`);
  
  const batch = [];
  for (let i = 0; i < Math.min(100, rows.length); i++) {
    const row = rows[i];
    const uf = row['UF'] || row['Sigla UF'] || row['Estado'] || 'BR';
    const crimeRaw = row['Tipo Crime'] || row['Crime'] || row['Natureza'] || 'Outros';
    const mesStr = (row['Mês'] || row['Mes'] || 'janeiro').toString().toLowerCase();
    const ano = parseInt(row['Ano'] || '2024');
    const vitimas = parseInt(row['Vítimas'] || row['Ocorrências'] || '0') || 0;
    
    const meses = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };
    const monthNum = meses[mesStr] !== undefined ? meses[mesStr] : 0;
    
    batch.push({
      id: crypto.randomUUID(),
      sourceId: 'SINESP',
      datasetId: 'sinesp-vde',
      stateCode: uf.toUpperCase().substring(0,2),
      municipalityName: null,
      category: 'other',
      sourceCategory: crimeRaw,
      occurredAt: new Date(ano, monthNum, 1),
      year: ano,
      month: monthNum + 1,
      latitude: null,
      longitude: null,
      isSyntheticPoint: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  if (batch.length > 0) {
    console.log(`Inserting ${batch.length} rows...`);
    await db.insert(securityOccurrences).values(batch);
    console.log('Inserted!');
  }
}
run();
