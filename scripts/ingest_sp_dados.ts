import { StreamingXlsxParser } from '../src/ingestion/parsers/StreamingXlsxParser.js';
import { SspIdentityService } from '../src/ingestion/adapters/ssp/SspIdentity.js';
import { normalizeLegacyCategory } from '../src/services/Taxonomy.js';
import { db } from '../src/db/index.js';
import { securityOccurrences } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function ingestSpDados() {
  const filePath = './data/temp/SPDadosCriminais_2026.xlsx';
  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log(`[Ingest SP] Iniciando carregamento de strings compartilhadas de ${filePath}...`);
  const start = Date.now();
  const sharedStrings = await StreamingXlsxParser.loadSharedStrings(filePath);
  const sheetPath = await StreamingXlsxParser.getWorksheetPath(filePath);
  console.log(`[Ingest SP] Identificada planilha de microdados: ${sheetPath}`);

  let totalParsed = 0;
  let totalWithCoords = 0;
  let totalInserted = 0;
  let batch: any[] = [];
  const BATCH_SIZE = 500;

  async function flushBatch() {
    if (batch.length === 0) return;
    try {
      // Usar transação / insert em batch
      await db.insert(securityOccurrences)
        .values(batch)
        .onConflictDoNothing();
      totalInserted += batch.length;
      if (totalInserted % 5000 === 0 || totalInserted === batch.length) {
        console.log(`[Ingest SP] Inseridos ${totalInserted} registros georreferenciados (Total lido: ${totalParsed})...`);
      }
    } catch (e: any) {
      console.error(`[Ingest SP] Erro ao inserir lote: ${e.message}`);
    }
    batch = [];
  }

  await StreamingXlsxParser.streamWorksheet(filePath, {
    sheetXmlPath: sheetPath,
  }, async (rowNum, row) => {
    totalParsed++;

    const latRaw = row['LATITUDE'];
    const lonRaw = row['LONGITUDE'];
    const coords = SspIdentityService.parseCoordinates(latRaw, lonRaw);

    // Se tiver coordenadas válidas no estado de SP
    if (coords.isValid && coords.latitude !== null && coords.longitude !== null) {
      totalWithCoords++;

      const anoBoRaw = row['ANO_BO'] || row['ANO_ESTATISTICA'] || 2026;
      const numBoRaw = row['NUM_BO'] || `BO_${totalParsed}`;
      const dpCircunscricao = row['NOME_DELEGACIA_CIRCUNSCRICAO'] || row['NOME_DELEGACIA'] || '01º D.P. SE';
      const natApuradaRaw = row['NATUREZA_APURADA'] || row['DELITO'] || row['DESCR_CONDUTA'] || 'OUTROS';
      const rubricaRaw = row['RUBRICA'] || '';

      const sourceCategory = String(natApuradaRaw).trim();
      const normalizedCategory = normalizeLegacyCategory(sourceCategory);

      const identity = SspIdentityService.buildIdentity(
        anoBoRaw,
        numBoRaw,
        dpCircunscricao,
        sourceCategory,
        rubricaRaw
      );

      const dateParsed = SspIdentityService.parseExcelOrDateString(row['DATA_OCORRENCIA_BO'] || row['DATA_REGISTRO']);
      const anoEstatistica = parseInt(String(row['ANO_ESTATISTICA'] || identity.anoBo), 10) || identity.anoBo;
      const mesEstatistica = parseInt(String(row['MES_ESTATISTICA'] || dateParsed.month || 7), 10) || 7;

      const codIbge = row['COD IBGE'] ? String(row['COD IBGE']).trim() : '3550308';
      const municipioTerritorial = row['NOME_MUNICIPIO_CIRCUNSCRICAO'] || row['NOME_MUNICIPIO'] || 'São Paulo';
      const bairro = row['BAIRRO'] ? String(row['BAIRRO']).trim() : null;
      const logradouro = row['LOGRADOURO'] ? String(row['LOGRADOURO']).trim() : null;
      const numLogradouro = row['NUMERO_LOGRADOURO'] ? String(row['NUMERO_LOGRADOURO']).trim() : null;
      
      let fullAddress = logradouro;
      if (fullAddress && numLogradouro) fullAddress += `, ${numLogradouro}`;
      if (fullAddress && bairro) fullAddress += ` - ${bairro}`;
      if (fullAddress) fullAddress += `, ${municipioTerritorial} - SP`;

      const occurredAt = dateParsed.date || new Date(`${anoEstatistica}-${String(mesEstatistica).padStart(2, '0')}-15T12:00:00Z`);

      batch.push({
        id: identity.sourceRecordId,
        sourceId: 'SSP-SP',
        datasetId: `SPDadosCriminais_2026`,
        sourceRecordId: identity.sourceRecordId,
        country: 'BR',
        stateCode: 'SP',
        stateName: 'São Paulo',
        municipalityCode: codIbge,
        municipalityName: municipioTerritorial,
        category: normalizedCategory,
        subcategory: rubricaRaw || null,
        sourceCategory: sourceCategory,
        occurredAt: occurredAt,
        year: anoEstatistica,
        month: mesEstatistica,
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationPrecision: 'exact',
        isSyntheticPoint: false,
        geocodingStatus: 'official_coordinates',
        geocodingProvider: 'SSP-SP',
        originalAddress: fullAddress,
        sourceData: JSON.stringify(row),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }
  });

  // Flush remaining
  await flushBatch();

  console.log(`[Ingest SP] Concluído em ${((Date.now() - start) / 1000).toFixed(1)}s!`);
  console.log(`[Ingest SP] Total Linhas: ${totalParsed}, Com Coordenadas: ${totalWithCoords}, Inseridas no Banco: ${totalInserted}`);
}

ingestSpDados().catch(e => {
  console.error('[Ingest SP] Erro fatal:', e);
  process.exit(1);
});
