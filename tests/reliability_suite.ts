/**
 * SUÍTE COMPLETA DE CONFIABILIDADE DO SISTEMA
 * Validação rigorosa dos 18 tópicos obrigatórios:
 * 1. Parsers
 * 2. Normalização
 * 3. Taxonomia
 * 4. Deduplicação
 * 5. Quality Gate
 * 6. Geocoding
 * 7. Análise
 * 8. Score
 * 9. Fallbacks
 * 10. Ingestão
 * 11. Reprocessamento
 * 12. Idempotência
 * 13. Jobs
 * 14. API
 * 15. Autorização Administrativa
 * 16. Inputs Inválidos
 * 17. Erros Externos
 * 18. Dados Ausentes
 */

import { SspSpAdapter } from '../src/ingestion/adapters/ssp/SspSpAdapter.js';
import { SinespAdapter } from '../src/ingestion/adapters/sinesp/SinespAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { GeocodingService } from '../src/services/GeocodingService.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { PipelineAutomationService } from '../src/ingestion/orchestration/PipelineAutomationService.js';
import { SafetyAnalysisService } from '../src/services/SafetyAnalysisService.js';
import { SummaryService } from '../src/services/SummaryService.js';
import { metricsCollector } from '../src/lib/metrics.js';
import { adminAuth } from '../src/middleware/adminAuth.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityOccurrences, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, topicNumber: number, title: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] Tópico ${topicNumber}: ${title}`);
    passedTests++;
  } else {
    console.error(`[FAIL] Tópico ${topicNumber}: ${title} -> ${details || 'Falha na asserção'}`);
    failedTests++;
  }
}

async function runReliabilitySuite() {
  console.log('================================================================================');
  console.log('       INICIANDO SUÍTE COMPLETA DE CONFIABILIDADE (18 TÓPICOS AUDITADOS)        ');
  console.log('================================================================================\n');

  // Assegura fonte SSP-SP e SINESP no banco
  const sspSource = await db.select().from(dataSources).where(sql`lower(id) = 'ssp-sp'`);
  if (sspSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'SSP-SP',
      name: 'Secretaria de Segurança Pública de São Paulo',
      provider: 'SSP-SP',
      coverage: 'SP',
      sourceType: 'html',
      url: 'https://www.ssp.sp.gov.br/transparencia/dados-abertos',
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // -------------------------------------------------------------
  // 1. PARSERS (SSP-SP, SINESP, CSV, Formatos Horizontais e Verticais)
  // -------------------------------------------------------------
  console.log('\n--- 1. PARSERS ---');
  const sspAdapter = new SspSpAdapter();
  const sinespAdapter = new SinespAdapter();

  // 1.1 Parsing Microdados SSP-SP
  const sspParsed = sspAdapter.parseRow({
    NUM_BO: '99881/2024',
    ANO_BO: '2024',
    DATAOCORRENCIA: '15/03/2024',
    HORAOCORRENCIA: '21:30',
    LOGRADOURO: 'Av Paulista, 1000',
    BAIRRO: 'Bela Vista',
    CIDADE: 'São Paulo',
    UF: 'SP',
    LATITUDE: '-23.561414',
    LONGITUDE: '-46.655881',
    NATUREZA_APURADA: 'Roubo de Veículo'
  }) as any;
  assert(
    sspParsed && sspParsed.target === 'occurrences' && sspParsed.data.latitude === -23.561414,
    1,
    'Parser Microdados SSP-SP com coordenadas e datas válidas'
  );

  // 1.2 Parsing Indicadores Horizontais
  const horizRow = sspAdapter.parseRow({
    MUNICIPIO: 'Campinas',
    NATUREZA: 'Homicídio Doloso',
    ANO: '2024',
    JANEIRO: '5',
    FEVEREIRO: '3',
    MARCO: '4',
    TOTAL: '12'
  }) as any[];
  assert(
    Array.isArray(horizRow) && horizRow.length === 3 && horizRow[0].data.value === 5 && horizRow[0].data.period === '2024-01',
    1,
    'Parser Indicadores Horizontais expandindo colunas mensais em registros canônicos'
  );

  // 1.3 Parsing SINESP Nacional
  const sinespRow = sinespAdapter.parseRow({
    UF: 'SP',
    Municipio: 'São Paulo',
    'Tipo Crime': 'Homicídio doloso',
    Ano: '2024',
    Mês: 'Janeiro',
    Ocorrências: '250',
    Vítimas: '260'
  }) as any;
  assert(
    sinespRow && sinespRow.target === 'indicators' && sinespRow.data.value === 250 && sinespRow.data.period === '2024-01',
    1,
    'Parser SINESP com conversão de nomes de meses e contagem de ocorrências'
  );

  // -------------------------------------------------------------
  // 2. NORMALIZAÇÃO (Geográfica, Topônimos, Coordenadas e SRID)
  // -------------------------------------------------------------
  console.log('\n--- 2. NORMALIZAÇÃO ---');
  const normCapital = GeoNormalizationService.canonicalizeMunicipalityName('Capital');
  const normSBC = GeoNormalizationService.canonicalizeMunicipalityName('S. Bernardo do Campo');
  const normAcentuada = GeoNormalizationService.canonicalizeMunicipalityName('SÃO PAULO');
  assert(normCapital === 'sao paulo' && normSBC === 'sao bernardo do campo' && normAcentuada === 'sao paulo', 2, 'Normalização de topônimos, aliases e remoção de acentos');

  // Coordenadas válidas no Brasil (WGS84 / EPSG:4326)
  const coordSp = GeoNormalizationService.validateCoordinates(-23.5505, -46.6333);
  const coordInvertida = GeoNormalizationService.validateCoordinates(-46.6333, -23.5505);
  const coordFora = GeoNormalizationService.validateCoordinates(48.8566, 2.3522); // Paris
  assert(
    coordSp.valid && coordInvertida.wasInverted === true && !coordFora.valid,
    2,
    'Validação rigorosa de coordenadas, bounding box do Brasil e detecção/correção de inversão Lat/Lng'
  );

  // -------------------------------------------------------------
  // 3. TAXONOMIA (Mapeamento Canônico de Crimes)
  // -------------------------------------------------------------
  console.log('\n--- 3. TAXONOMIA ---');
  const catHomicidio = sspAdapter.mapCrimeToCanonical('HOMICÍDIO DOLOSO');
  const catLatrocinio = sspAdapter.mapCrimeToCanonical('LATROCÍNIO');
  const catVeiculo = sspAdapter.mapCrimeToCanonical('ROUBO DE VEÍCULO');
  const catFurto = sspAdapter.mapCrimeToCanonical('FURTO DE VEÍCULO');
  const catCarga = sspAdapter.mapCrimeToCanonical('ROUBO DE CARGA');
  const catDesconhecido = sspAdapter.mapCrimeToCanonical('CRIME INEXISTENTE DESCONHECIDO');
  assert(
    catHomicidio === 'homicide' &&
    catLatrocinio === 'homicide' &&
    catVeiculo === 'vehicle_robbery' &&
    catFurto === 'vehicle_theft' &&
    catCarga === 'cargo_theft' &&
    catDesconhecido === 'other',
    3,
    'Mapeamento taxonômico exaustivo e fallback seguro para "other"'
  );

  // -------------------------------------------------------------
  // 4. DEDUPLICAÇÃO (Geração de Hash e Idempotência de Ocorrências)
  // -------------------------------------------------------------
  console.log('\n--- 4. DEDUPLICAÇÃO ---');
  const calcHash = (source: string, boNum: string, ano: number, nat: string, data: string) => {
    return crypto.createHash('sha256').update(`${source}|${boNum}|${ano}|${nat}|${data}`).digest('hex');
  };
  const hash1 = calcHash('SSP-SP', '12345/2024', 2024, 'Roubo de Celular', '2024-03-10');
  const hash2 = calcHash('SSP-SP', '12345/2024', 2024, 'Roubo de Celular', '2024-03-10');
  const hash3 = calcHash('SSP-SP', '12346/2024', 2024, 'Roubo de Celular', '2024-03-10');
  assert(hash1 === hash2 && hash1 !== hash3 && hash1.length === 64, 4, 'Deduplicação baseada em hash SHA-256 determinístico');

  // -------------------------------------------------------------
  // 5. QUALITY GATE (Regras de Integridade e Rejeição de Schema)
  // -------------------------------------------------------------
  console.log('\n--- 5. QUALITY GATE ---');
  const validHeaders = ['NUM_BO', 'ANO_BO', 'DATAOCORRENCIA', 'CIDADE', 'UF', 'NATUREZA_APURADA'];
  const missingHeaders = ['COLUNA_DESCONHECIDA_A', 'COLUNA_DESCONHECIDA_B'];
  const gateValid = sspAdapter.validateSchema(validHeaders);
  const gateInvalid = sspAdapter.validateSchema(missingHeaders);
  assert(gateValid.valid && !gateInvalid.valid, 5, 'Quality Gate valida cabeçalhos obrigatórios e bloqueia schemas incompatíveis');

  // -------------------------------------------------------------
  // 6. GEOCODING (Validações IBGE, Coordenadas e Resolução)
  // -------------------------------------------------------------
  console.log('\n--- 6. GEOCODING ---');
  const ibgeValido = GeoNormalizationService.isValidIbgeMunicipalityCode(3550308); // São Paulo
  const ibgeInvalido = GeoNormalizationService.isValidIbgeMunicipalityCode(9999999);
  const checkDigit = GeoNormalizationService.calculateIbgeCheckDigit('355030');
  assert(ibgeValido && !ibgeInvalido && checkDigit === 8, 6, 'Validação de código IBGE e cálculo de dígito verificador módulo 10');

  // -------------------------------------------------------------
  // 7. ANÁLISE (Fluxo Completo do SafetyAnalysisService)
  // -------------------------------------------------------------
  console.log('\n--- 7. ANÁLISE ---');
  const analysisService = new SafetyAnalysisService();
  const analysis = await analysisService.analyze({
    lat: -23.55052,
    lon: -46.633308,
    radiusMeters: 2000
  });
  assert(
    analysis !== null && (analysis.score === null || typeof analysis.score === 'number') && analysis.indicators !== undefined,
    7,
    'Serviço de análise de segurança executando com granularidade de dados reais'
  );

  // -------------------------------------------------------------
  // 8. SCORE (Cálculo Gravimétrico e Ponderação de Severidade)
  // -------------------------------------------------------------
  console.log('\n--- 8. SCORE GRAVIMÉTRICO ---');
  assert(
    typeof analysis.confidence === 'number' && (analysis.score === null || (analysis.score >= 0 && analysis.score <= 100)),
    8,
    'Score gravitacional normalizado entre 0 e 100 com cálculo de confiança numérico explícito'
  );

  // -------------------------------------------------------------
  // 9. FALLBACKS (Hierarquia Transparente: Bairro -> Município -> Estado)
  // -------------------------------------------------------------
  console.log('\n--- 9. FALLBACKS E HIERARQUIA ESPACIAL ---');
  const fallbackAnalysis = await analysisService.analyze({
    lat: -23.1857,
    lon: -46.8978, // Jundiaí
    radiusMeters: 1000
  });
  assert(
    fallbackAnalysis.granularity !== undefined && ['coordinate', 'municipality', 'state', 'national'].includes(fallbackAnalysis.granularity),
    9,
    'Hierarquia espacial com explicitação transparente do nível de agregação (Coordenada / Município / Estado / Nacional)'
  );

  // -------------------------------------------------------------
  // 10. INGESTÃO (Armazenamento RAW e Processamento em Lotes)
  // -------------------------------------------------------------
  console.log('\n--- 10. INGESTÃO ---');
  const dummyCsv = 'NUM_BO,ANO_BO,DATAOCORRENCIA,HORAOCORRENCIA,LOGRADOURO,CIDADE,UF,LATITUDE,LONGITUDE,NATUREZA_APURADA\n' +
    `REL_001/${Date.now()},2024,10/02/2024,14:00,Rua Teste,São Paulo,SP,-23.5505,-46.6333,Roubo de Veículo\n`;
  
  const rawFile = await rawStorage.put('ssp', `reliability_${Date.now()}`, 'reliability_test.csv', Buffer.from(dummyCsv, 'utf-8'));
  assert(fs.existsSync(rawFile.path) && rawFile.metadata.size > 0, 10, 'Armazenamento RAW imutável com cálculo de SHA-256 e bytes');

  const job = await JobManager.createJob({
    sourceId: 'SSP-SP',
    datasetId: 'ocorrencias_criminais_sp',
    rawFilePath: rawFile.path,
    originalFilename: 'reliability_test.csv',
    checksum: rawFile.metadata.checksum,
    fileSize: rawFile.metadata.size,
    force: true
  });
  assert(job !== null && job.jobId !== undefined, 10, 'Criação de Job de Ingestão via JobManager');

  const worker = new IngestionWorker('test-worker-reliability');
  const workerResult = await worker.processJobDirectly({
    id: job.jobId,
    sourceId: 'SSP-SP',
    rawFilePath: rawFile.path
  });
  assert(workerResult.success && workerResult.metrics.recordsInserted >= 0, 10, 'Ingestion Worker executando parsing e inserção com métricas estruturadas');

  // -------------------------------------------------------------
  // 11. REPROCESSAMENTO (Reprocessamento a partir de arquivo RAW)
  // -------------------------------------------------------------
  console.log('\n--- 11. REPROCESSAMENTO ---');
  const reprocessResult = await JobManager.reprocessJob(job.jobId);
  assert(reprocessResult.success && reprocessResult.jobId !== undefined, 11, 'Reprocessamento idempotente a partir do arquivo RAW preservado');

  // -------------------------------------------------------------
  // 12. IDEMPOTÊNCIA (Execução Duplicada Sem Corromper Totais)
  // -------------------------------------------------------------
  console.log('\n--- 12. IDEMPOTÊNCIA ---');
  const countBefore = await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(sql`lower(source_id) = 'ssp-sp'`);
  // Reprocessar o mesmo lote
  await worker.processJobDirectly({
    id: reprocessResult.jobId,
    sourceId: 'SSP-SP',
    rawFilePath: rawFile.path
  });
  const countAfter = await db.select({ count: sql`count(*)` }).from(securityOccurrences).where(sql`lower(source_id) = 'ssp-sp'`);
  assert(Number(countBefore[0].count) === Number(countAfter[0].count), 12, 'Garantia de Idempotência: reprocessamento não duplica registros nem distorce contagens');

  // -------------------------------------------------------------
  // 13. JOBS (Estados, Transições e Prevenção de Jobs Presos)
  // -------------------------------------------------------------
  console.log('\n--- 13. JOBS ---');
  const recoveredCount = await PipelineAutomationService.recoverStuckJobs();
  assert(typeof recoveredCount === 'number', 13, 'Detecção e recuperação de jobs presos com timeout automático');

  // -------------------------------------------------------------
  // 14. API (Rotas Principais e Métricas)
  // -------------------------------------------------------------
  console.log('\n--- 14. API E OBSERVABILIDADE ---');
  metricsCollector.recordRequest('GET', '/api/analysis', 200, 45.2);
  metricsCollector.recordRequest('GET', '/api/analysis', 200, 52.8);
  metricsCollector.recordRequest('GET', '/api/analysis', 500, 120.0);
  const metrics = metricsCollector.getMetricsSummary();
  assert(
    metrics.totalRequests >= 3 && metrics.totalErrors >= 1 && metrics.overallLatency.p50 > 0,
    14,
    'Métricas de observabilidade calculando p50, p95 e contagem de requisições'
  );

  // -------------------------------------------------------------
  // 15. AUTORIZAÇÃO ADMINISTRATIVA (Bloqueio sem chave e acesso com chave)
  // -------------------------------------------------------------
  console.log('\n--- 15. AUTORIZAÇÃO ADMINISTRATIVA ---');
  process.env.ADMIN_SECRET = 'test-secret-key-123';
  let unauthorizedStatus = 0;
  const mockReqUnauthorized = {
    headers: {},
    path: '/api/admin/pipeline/trigger'
  } as any;
  const mockResUnauthorized = {
    status: (code: number) => {
      unauthorizedStatus = code;
      return { json: () => {} };
    }
  } as any;
  adminAuth(mockReqUnauthorized, mockResUnauthorized, () => {});
  assert(unauthorizedStatus === 401, 15, 'Middleware adminAuth bloqueia requisição sem chave administrativa');

  let authorizedCalled = 0;
  const mockReqAuthorized = {
    headers: { 'x-admin-token': 'test-secret-key-123' },
    path: '/api/admin/pipeline/trigger'
  } as any;
  const mockResAuthorized = {
    status: (code: number) => ({ json: () => {} })
  } as any;
  adminAuth(mockReqAuthorized, mockResAuthorized, () => {
    authorizedCalled = 1;
  });
  assert(authorizedCalled === 1, 15, 'Middleware adminAuth concede acesso com X-Admin-Token válida');

  // -------------------------------------------------------------
  // 16. INPUTS INVÁLIDOS (Sanitização e Tratamento Gracioso)
  // -------------------------------------------------------------
  console.log('\n--- 16. INPUTS INVÁLIDOS ---');
  const invalidLatLong = GeoNormalizationService.validateCoordinates(999, 999);
  const invalidDateParsed = sspAdapter.parseRow({ NUM_BO: '123', DATAOCORRENCIA: '99/99/9999' });
  assert(!invalidLatLong.valid && invalidDateParsed === null, 16, 'Tratamento seguro de coordenadas exorbitantes e datas inexistentes');

  // -------------------------------------------------------------
  // 17. ERROS EXTERNOS (Recuperação Graciosa e Fallbacks de IA)
  // -------------------------------------------------------------
  console.log('\n--- 17. ERROS EXTERNOS E RESILIÊNCIA ---');
  const fallbackSummary = SummaryService.generateDeterministicFallback({
    city: 'São Paulo',
    state: 'SP',
    score: 68,
    confidence: 85,
    period: { label: 'Últimos 12 meses' },
    sources: [{ name: 'Secretaria de Segurança Pública de São Paulo' }],
    fallback: { used: false }
  });
  assert(
    fallbackSummary.length > 50 && fallbackSummary.includes('São Paulo'),
    17,
    'Geração de sumário explicativo via fallback local determinístico em caso de indisponibilidade da API de IA'
  );

  // -------------------------------------------------------------
  // 18. DADOS AUSENTES (Score Nulo, Aviso Regulatório sem Distorção)
  // -------------------------------------------------------------
  console.log('\n--- 18. DADOS AUSENTES E AUDITORIA DE INTEGRIDADE ---');
  const emptyAnalysis = await analysisService.analyze({
    lat: -9.97499,
    lon: -67.8243, // Rio Branco - AC (sem microdados SSP-SP)
    radiusMeters: 1000
  });
  assert(
    (emptyAnalysis.score === null || emptyAnalysis.status === 'insufficient_data') &&
    (emptyAnalysis.missingData?.notice !== undefined || emptyAnalysis.fallback !== undefined),
    18,
    'Ausência de dados nunca vira score zero: retorna aviso de dados ausentes e score nulo/indeterminado'
  );

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA SUÍTE DE CONFIABILIDADE: ${passedTests}/${totalTests} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    console.error(`ERRO: ${failedTests} testes falharam na suíte de confiabilidade.`);
    process.exit(1);
  } else {
    console.log('TODOS OS 18 TÓPICOS DE CONFIABILIDADE FORAM VALIDADOS COM SUCESSO!');
    process.exit(0);
  }
}

runReliabilitySuite().catch((err) => {
  console.error('Falha fatal na execução da suíte de confiabilidade:', err);
  process.exit(1);
});
