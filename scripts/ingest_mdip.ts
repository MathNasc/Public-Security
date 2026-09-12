import * as XLSX from 'xlsx';
import { SspIdentityService } from '../src/ingestion/adapters/ssp/SspIdentity.js';
import { normalizeLegacyCategory } from '../src/services/Taxonomy.js';
import { db } from '../src/db/index.js';
import { securityOccurrences } from '../src/db/schema.js';
import fs from 'fs';

async function ingestMdip() {
  const filePath = './data/temp/MDIP_2026.xlsx';
  if (!fs.existsSync(filePath)) {
    console.log('MDIP file not found.');
    return;
  }

  console.log('[Ingest MDIP] Lendo MDIP_2026.xlsx...');
  const wb = XLSX.readFile(filePath);
  const data: any[] = XLSX.utils.sheet_to_json(wb.Sheets['MDIP_2013_A_2026'] || wb.Sheets[wb.SheetNames[0]]);
  console.log(`[Ingest MDIP] Total de linhas: ${data.length}`);

  let inserted = 0;
  let batch: any[] = [];

  async function flush() {
    if (batch.length === 0) return;
    await db.insert(securityOccurrences).values(batch).onConflictDoNothing();
    inserted += batch.length;
    batch = [];
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const coords = SspIdentityService.parseCoordinates(row.LATITUDE, row.LONGITUDE);
    if (!coords.isValid || coords.latitude === null || coords.longitude === null) continue;

    const anoBo = parseInt(String(row.ANO_BO || row['ANO ESTATISTICA'] || 2026), 10) || 2026;
    const numBo = String(row.NUM_BO || `MDIP_${i}`);
    const dpCirc = String(row['DP_CIRCUNSCRICAO '] || row.DP_CIRCUNSCRICAO || row.DP_ELABORACAO || 'DHPP');
    const sourceCategory = 'MORTE DECORRENTE DE INTERVENÇÃO POLICIAL';
    const normalizedCategory = normalizeLegacyCategory(sourceCategory);

    const identity = SspIdentityService.buildIdentity(anoBo, numBo, dpCirc, sourceCategory, 'MDIP', i);
    const dateParsed = SspIdentityService.parseExcelOrDateString(row.DATA_FATO || row.DATAHORA_REGISTRO_BO);
    const anoEstat = parseInt(String(row['ANO ESTATISTICA'] || anoBo), 10) || anoBo;
    const mesEstat = parseInt(String(row['MÊS ESTATISTICA'] || 1), 10) || 1;

    const muni = row.MUNICIPIO_CIRCUNSCRICAO || row.MUNICIPIO_ELABORACAO || 'São Paulo';
    const logradouro = row.LOGRADOURO ? `${row.LOGRADOURO}${row.NUMERO_LOGRADOURO ? ', ' + row.NUMERO_LOGRADOURO : ''}` : null;
    const occurredAt = dateParsed.date || new Date(`${anoEstat}-${String(mesEstat).padStart(2, '0')}-15T12:00:00Z`);

    batch.push({
      id: identity.sourceRecordId,
      sourceId: 'SSP-SP',
      datasetId: 'MDIP',
      sourceRecordId: identity.sourceRecordId,
      country: 'BR',
      stateCode: 'SP',
      stateName: 'São Paulo',
      municipalityCode: '3550308',
      municipalityName: muni,
      category: normalizedCategory,
      subcategory: 'Morte Decorrente de Intervenção Policial',
      sourceCategory: sourceCategory,
      occurredAt,
      year: anoEstat,
      month: mesEstat,
      latitude: coords.latitude,
      longitude: coords.longitude,
      locationPrecision: 'exact',
      isSyntheticPoint: false,
      geocodingStatus: 'official_coordinates',
      geocodingProvider: 'SSP-SP',
      originalAddress: logradouro ? `${logradouro}, ${muni} - SP` : `${muni} - SP`,
      sourceData: JSON.stringify(row),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    if (batch.length >= 500) {
      await flush();
    }
  }

  await flush();
  console.log(`[Ingest MDIP] Inseridos ${inserted} registros MDIP georreferenciados!`);
}

ingestMdip().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
