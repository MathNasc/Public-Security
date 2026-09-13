import { StreamingXlsxParser } from '../src/ingestion/parsers/StreamingXlsxParser.js';
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

  console.log('[Ingest MDIP] Lendo MDIP_2026.xlsx com streaming...');
  const sharedStrings = await StreamingXlsxParser.loadSharedStrings(filePath);
  const sheetPath = await StreamingXlsxParser.getWorksheetPath(filePath);

  let inserted = 0;
  let totalParsed = 0;
  let batch: any[] = [];

  async function flush() {
    if (batch.length === 0) return;
    await db.insert(securityOccurrences).values(batch).onConflictDoNothing();
    inserted += batch.length;
    batch = [];
  }

  await StreamingXlsxParser.streamWorksheet(filePath, { sheetXmlPath: sheetPath }, async (rowNum, row) => {
    totalParsed++;
    const coords = SspIdentityService.parseCoordinates(row['LATITUDE'], row['LONGITUDE']);
    if (!coords.isValid || coords.latitude === null || coords.longitude === null) return;

    const anoBo = parseInt(String(row['ANO_BO'] || row['ANO ESTATISTICA'] || 2026), 10) || 2026;
    const numBo = String(row['NUM_BO'] || `MDIP_${totalParsed}`);
    const dpCirc = String(row['DP_CIRCUNSCRICAO '] || row['DP_CIRCUNSCRICAO'] || row['DP_ELABORACAO'] || 'DHPP');
    const sourceCategory = 'MORTE DECORRENTE DE INTERVENÇÃO POLICIAL';
    const normalizedCategory = normalizeLegacyCategory(sourceCategory);

    const identity = SspIdentityService.buildIdentity(anoBo, numBo, dpCirc, sourceCategory, 'MDIP', totalParsed);
    const dateParsed = SspIdentityService.parseExcelOrDateString(row['DATA_FATO'] || row['DATAHORA_REGISTRO_BO']);
    const anoEstat = parseInt(String(row['ANO ESTATISTICA'] || anoBo), 10) || anoBo;
    const mesEstat = parseInt(String(row['MÊS ESTATISTICA'] || 1), 10) || 1;

    const muni = row['MUNICIPIO_CIRCUNSCRICAO'] || row['MUNICIPIO_ELABORACAO'] || 'São Paulo';
    const logradouro = row['LOGRADOURO'] ? `${row['LOGRADOURO']}${row['NUMERO_LOGRADOURO'] ? ', ' + row['NUMERO_LOGRADOURO'] : ''}` : null;
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
  });

  await flush();
  console.log(`[Ingest MDIP] Inseridos ${inserted} registros MDIP georreferenciados!`);
}

ingestMdip().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
