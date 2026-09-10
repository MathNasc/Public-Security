import { db } from './src/db/index.js';
import { securityIndicators } from './src/db/schema.js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';

async function seed() {
  const fileContent = fs.readFileSync('src/ingestion/adapters/sinesp/fixtures/sinesp_sample.csv', 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';'
  });

  const monthMap: Record<string, string> = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
  };

  function normalize(raw: string) {
    const l = raw.toLowerCase();
    if (l.includes('homicídio doloso')) return 'homicidio_doloso';
    if (l.includes('roubo de veículo')) return 'roubo_veiculo';
    if (l.includes('furto de veículo')) return 'furto_veiculo';
    if (l.includes('roubo de carga')) return 'roubo_carga';
    if (l.includes('latrocínio')) return 'latrocinio';
    if (l.includes('estupro')) return 'estupro';
    return 'outros';
  }

  const values = records.map((row: any) => {
    const uf = row.UF || row.uf;
    const city = row['Município'] || row.municipio;
    const crime = row['Tipo Crime'] || row['tipo_crime'];
    const ano = row.Ano || row.ano;
    const mes = row['Mês'] || row.mes;
    const ocorrencias = row['Ocorrências'] || row.ocorrencias || 0;
    
    const mm = monthMap[mes?.toLowerCase()] || '01';
    
    return {
      id: crypto.randomUUID(),
      sourceId: 'SINESP',
      datasetId: 'indicadores_municipais',
      stateCode: uf,
      municipalityCode: 'UNKNOWN', // Or map it
      category: normalize(crime || ''),
      subcategory: crime,
      period: `${ano}-${mm}`,
      value: parseInt(ocorrencias, 10),
      unit: 'occurrences',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  try {
    for (const val of values) {
      await db.insert(securityIndicators).values(val).onConflictDoNothing();
    }
    console.log("Seeded", values.length, "SINESP records!");
  } catch (e) {
    console.error("Error:", e);
  }
}
seed();
