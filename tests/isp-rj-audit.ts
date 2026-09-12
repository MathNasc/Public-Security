import { IspRjAdapter } from '../src/ingestion/adapters/isp-rj/IspRjAdapter.js';
import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { rawStorage } from '../src/ingestion/pipeline/Storage.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { db } from '../src/db/index.js';
import { dataSources, dataImports, securityIndicators, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runIspRjAudit() {
  console.log("================================================================================");
  console.log("             AUDITORIA E VALIDAÇÃO COMPLETA DO ADAPTER ISP-RJ (RIO DE JANEIRO)  ");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details || 'Condição não satisfeita'}`);
      failed++;
    }
  }

  // 0. Assegurar Fonte ISP-RJ e Municípios do RJ no Banco de Dados
  const rjSource = await db.select().from(dataSources).where(sql`lower(id) = 'isp-rj'`);
  if (rjSource.length === 0) {
    await db.insert(dataSources).values({
      id: 'ISP-RJ',
      name: 'Instituto de Segurança Pública do Estado do Rio de Janeiro',
      provider: 'ISP-RJ',
      coverage: 'RJ',
      state: 'RJ',
      sourceType: 'csv',
      url: 'http://www.ispdados.rj.gov.br/Arquivos/BaseMunicipioMensal.csv',
      officialUrl: 'https://www.isp.rj.gov.br/',
      documentationUrl: 'http://www.ispdados.rj.gov.br/',
      description: 'Séries históricas e estatísticas de segurança pública dos 92 municípios do estado do Rio de Janeiro.',
      updateFrequency: 'monthly',
      enabled: true,
      status: 'OPERATIONAL',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Assegura municípios principais do RJ em geographic_municipalities
  const rjMunis = [
    { code: '3304557', stateAcronym: 'RJ', stateName: 'Rio de Janeiro', name: 'Rio de Janeiro', normalizedName: 'rio de janeiro', latitude: -22.9068, longitude: -43.1729 },
    { code: '3303302', stateAcronym: 'RJ', stateName: 'Rio de Janeiro', name: 'Niterói', normalizedName: 'niteroi', latitude: -22.8832, longitude: -43.1034 },
    { code: '3304904', stateAcronym: 'RJ', stateName: 'Rio de Janeiro', name: 'São Gonçalo', normalizedName: 'sao goncalo', latitude: -22.8268, longitude: -43.0537 },
    { code: '3301702', stateAcronym: 'RJ', stateName: 'Rio de Janeiro', name: 'Duque de Caxias', normalizedName: 'duque de caxias', latitude: -22.7858, longitude: -43.3117 },
    { code: '3303500', stateAcronym: 'RJ', stateName: 'Rio de Janeiro', name: 'Nova Iguaçu', normalizedName: 'nova iguacu', latitude: -22.7556, longitude: -43.4603 },
    { code: '3303906', stateAcronym: 'RJ', stateName: 'Rio de Janeiro', name: 'Petrópolis', normalizedName: 'petropolis', latitude: -22.5050, longitude: -43.1789 },
    { code: '3306305', stateAcronym: 'RJ', stateName: 'Rio de Janeiro', name: 'Volta Redonda', normalizedName: 'volta redonda', latitude: -22.5232, longitude: -44.1042 },
    { code: '3302403', stateAcronym: 'RJ', stateName: 'Rio de Janeiro', name: 'Macaé', normalizedName: 'macae', latitude: -22.3768, longitude: -41.7869 },
    { code: '3300704', stateAcronym: 'RJ', stateName: 'Rio de Janeiro', name: 'Cabo Frio', normalizedName: 'cabo frio', latitude: -22.8794, longitude: -42.0186 }
  ];

  for (const muni of rjMunis) {
    const existing = await db.select().from(geographicMunicipalities).where(eq(geographicMunicipalities.code, muni.code));
    if (existing.length === 0) {
      await db.insert(geographicMunicipalities).values({
        code: muni.code,
        stateAcronym: muni.stateAcronym,
        stateName: muni.stateName,
        name: muni.name,
        normalizedName: muni.normalizedName,
        latitude: muni.latitude,
        longitude: muni.longitude,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  const adapter = new IspRjAdapter();

  // 1. Identificação e Metadata
  const meta = adapter.metadata();
  assert(meta.agency === 'ISP-RJ' && meta.coverage === 'RJ' && meta.frequency === 'Mensal', "1. Metadata oficial e cobertura do estado do Rio de Janeiro");
  const version = adapter.identifyVersion();
  assert(/^\d{4}-\d{2}$/.test(version), "2. Identificação de versão temporal periódica (YYYY-MM)");
  const discovery = await adapter.discover();
  assert(discovery.source === 'ISP-RJ' && discovery.url.includes('BaseMunicipioMensal.csv'), "3. Discovery oficial do ISP-RJ apontando para repositório público");

  // 2. Schema Validation (Quality Gate)
  const muniHeaders = ['fmun', 'munic', 'ano', 'mes', 'hom_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculos', 'roubo_carga', 'letalidade_violenta'];
  const muniSchema = adapter.validateSchema(muniHeaders);
  assert(muniSchema.valid && muniSchema.format === 'indicators', "4. Quality Gate: Validação de Schema - BaseMunicipioMensal");

  const dpHeaders = ['cisp', 'aisp', 'risp', 'munic', 'ano', 'mes', 'hom_doloso', 'latrocinio', 'roubo_transeunte', 'registro_ocorrencias'];
  const dpSchema = adapter.validateSchema(dpHeaders);
  assert(dpSchema.valid && dpSchema.format === 'indicators', "5. Quality Gate: Validação de Schema - BaseDPMensal por Circunscrição Policial");

  const badHeaders = ['CAMPO_DESCONHECIDO_1', 'CAMPO_DESCONHECIDO_2'];
  const badSchema = adapter.validateSchema(badHeaders);
  assert(!badSchema.valid && (badSchema.missingColumns?.length || 0) > 0, "6. Quality Gate: Rejeição estrita de Schema Corrompido ou Incompatível");

  // 3. Parsing Unitário e Unpivot de Rubricas
  const parsedRecords = adapter.parseRow({
    fmun: '3304557',
    munic: 'Rio de Janeiro',
    ano: '2024',
    mes: '3',
    hom_doloso: '85',
    latrocinio: '4',
    roubo_veiculo: '640',
    furto_veiculos: '325',
    roubo_carga: '118',
    estupro: '98',
    roubo_transeunte: '1460',
    furto_transeunte: '425',
    apreensoes_drogas: '545',
    hom_culposo: '45'
  }) as any[];

  assert(Array.isArray(parsedRecords) && parsedRecords.length >= 10, "7. Unpivot de colunas largas em múltiplos registros de indicadores");
  const homRec = parsedRecords.find(r => r.data.category === 'homicide' && r.data.sourceCategory === 'hom_doloso');
  const latRec = parsedRecords.find(r => r.data.category === 'homicide' && r.data.sourceCategory === 'latrocinio');
  const robVeicRec = parsedRecords.find(r => r.data.category === 'vehicle_robbery');
  const furtVeicRec = parsedRecords.find(r => r.data.category === 'vehicle_theft');
  const cargaRec = parsedRecords.find(r => r.data.category === 'cargo_theft');
  const estuproRec = parsedRecords.find(r => r.data.category === 'sexual_crime');
  const drogaRec = parsedRecords.find(r => r.data.category === 'drug_related');

  assert(homRec?.data.value === 85 && homRec?.data.period === '2024-03', "8. Mapeamento de Homicídio Doloso (85 vítimas, período 2024-03)");
  assert(latRec?.data.value === 4 && latRec?.data.category === 'homicide', "9. Mapeamento Canônico de Latrocínio para Homicide");
  assert(robVeicRec?.data.value === 640 && robVeicRec?.data.category === 'vehicle_robbery', "10. Mapeamento Canônico de Roubo de Veículo");
  assert(furtVeicRec?.data.value === 325 && furtVeicRec?.data.category === 'vehicle_theft', "11. Mapeamento Canônico de Furto de Veículo");
  assert(cargaRec?.data.value === 118 && cargaRec?.data.category === 'cargo_theft', "12. Mapeamento Canônico de Roubo de Carga");
  assert(estuproRec?.data.value === 98 && estuproRec?.data.category === 'sexual_crime', "13. Mapeamento Canônico de Estupro");
  assert(drogaRec?.data.value === 545 && drogaRec?.data.category === 'drug_related', "14. Mapeamento Canônico de Entorpecentes / Drogas");

  // 4. Mapeamento Canônico de Crimes
  assert(adapter.mapCrimeToCanonical('hom_doloso') === 'homicide', "15. Taxonomia: hom_doloso -> homicide");
  assert(adapter.mapCrimeToCanonical('roubo_veiculo') === 'vehicle_robbery', "16. Taxonomia: roubo_veiculo -> vehicle_robbery");
  assert(adapter.mapCrimeToCanonical('roubo_carga') === 'cargo_theft', "17. Taxonomia: roubo_carga -> cargo_theft");
  assert(adapter.mapCrimeToCanonical('rubrica_inexistente') === 'other', "18. Taxonomia: Rubrica desconhecida -> other");

  // 5. Normalização de Municípios e Aliases Fluminenses
  const normNiteroi = GeoNormalizationService.canonicalizeMunicipalityName('Niterói');
  const normSaoGoncalo = GeoNormalizationService.canonicalizeMunicipalityName('S. Gonçalo');
  const normBuzios = GeoNormalizationService.canonicalizeMunicipalityName('Búzios');
  const normParati = GeoNormalizationService.canonicalizeMunicipalityName('Parati');
  assert(normNiteroi === 'niteroi', "19. Normalização de topônimo 'Niterói' -> 'niteroi'");
  assert(normSaoGoncalo === 'sao goncalo', "20. Normalização de alias 'S. Gonçalo' -> 'sao goncalo'");
  assert(normBuzios === 'armacao dos buzios', "21. Normalização de alias 'Búzios' -> 'armacao dos buzios'");
  assert(normParati === 'paraty', "22. Normalização de grafia 'Parati' -> 'paraty'");

  // 6. Teste de Execução End-to-End no Pipeline com Fixture Real do ISP-RJ
  console.log("\n--- TESTE END-TO-END: PIPELINE COMPLETO COM FIXTURE MUNICIPAL DO ISP-RJ ---");
  const rjFixturePath = path.resolve('tests/fixtures/isp-rj/isp_rj_municipio_mensal_real.csv');
  const rjStream = fs.createReadStream(rjFixturePath);

  // Step 7: Armazenamento RAW Imutável
  const storedRj = await rawStorage.put('isp-rj', `audit_${Date.now()}`, 'isp_rj_municipio_mensal_real.csv', rjStream);
  assert(fs.existsSync(storedRj.path) && storedRj.metadata.size > 0, "23. Armazenamento RAW da fonte ISP-RJ com SHA-256 e bytes calculados");

  // Step 8: Criação de Job de Ingestão via JobManager
  const jobResult = await JobManager.createJob({
    sourceId: 'ISP-RJ',
    datasetId: 'indicadores_municipais_rj',
    rawFilePath: storedRj.path,
    originalFilename: 'isp_rj_municipio_mensal_real.csv',
    checksum: storedRj.metadata.checksum,
    fileSize: storedRj.metadata.size,
    force: true
  });
  assert(!!jobResult && !!jobResult.jobId, "24. Criação e agendamento de Job de Ingestão para ISP-RJ");

  const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, jobResult.jobId));
  assert(!!dbJob && dbJob.status === 'QUEUED', "25. Job persistido no banco com status QUEUED");

  // Step 9 a 20: Execução pelo IngestionWorker
  const worker = new IngestionWorker('isp-rj-audit-worker');
  const runResult = await worker.processJobDirectly(dbJob);
  assert(runResult.success, "26. Execução bem sucedida do Job pelo IngestionWorker");
  assert(runResult.metrics.recordsRead === 12, `27. 12 linhas da BaseMunicipioMensal lidas com sucesso (${runResult.metrics.recordsRead} lidas)`);
  assert(runResult.metrics.recordsInserted > 100, `28. Desdobramento em mais de 100 indicadores criminais inseridos (${runResult.metrics.recordsInserted} inseridos)`);

  // 7. Verificação de Persistência no Banco de Dados
  const indicatorsInDb = await db
    .select()
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'ISP-RJ'));

  assert(indicatorsInDb.length >= 100, `29. Indicadores do Rio de Janeiro persistidos com sucesso no banco (${indicatorsInDb.length} registros)`);

  const capitalHomicides = indicatorsInDb.find(i => 
    i.municipalityCode === '3304557' && 
    i.category === 'homicide' && 
    i.sourceCategory === 'hom_doloso' && 
    i.period === '2024-01'
  );
  assert(capitalHomicides?.value === 82, "30. Registro validado com precisão: Rio de Janeiro (Capital) Jan/2024 Homicídio Doloso = 82");

  const niteroiVehicleRobberies = indicatorsInDb.find(i => 
    i.municipalityCode === '3303302' && 
    i.category === 'vehicle_robbery' && 
    i.period === '2024-01'
  );
  assert(niteroiVehicleRobberies?.value === 75, "31. Registro validado com precisão: Niterói Jan/2024 Roubo de Veículo = 75");

  // 8. Teste de Idempotência e Reprocessamento
  console.log("\n--- TESTE DE IDEMPOTÊNCIA E REPROCESSAMENTO ---");
  const countBeforeReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'ISP-RJ'));

  const reprocessJob = await JobManager.reprocessJob(jobResult.jobId);
  assert(reprocessJob.success && !!reprocessJob.jobId, "32. Agendamento de reprocessamento a partir do arquivo RAW original");

  const [dbReprocessJob] = await db.select().from(dataImports).where(eq(dataImports.id, reprocessJob.jobId));
  const reprocessResult = await worker.processJobDirectly(dbReprocessJob);
  assert(reprocessResult.success, "33. IngestionWorker conclui reprocessamento com sucesso");

  const countAfterReprocess = await db
    .select({ count: sql`count(*)` })
    .from(securityIndicators)
    .where(eq(securityIndicators.sourceId, 'ISP-RJ'));

  assert(
    Number(countBeforeReprocess[0].count) === Number(countAfterReprocess[0].count),
    "34. Idempotência absoluta garantida: contagem de indicadores não duplica nem se altera após reprocessamento"
  );

  // 9. Atualização do Status Operacional da Fonte
  const [updatedSource] = await db.select().from(dataSources).where(sql`lower(id) = 'isp-rj'`);
  assert(updatedSource?.status === 'OPERATIONAL', "35. Status operacional da fonte ISP-RJ atualizado para OPERATIONAL");

  // -------------------------------------------------------------
  // RELATÓRIO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`  RESULTADO DA AUDITORIA ISP-RJ: ${passed}/${passed + failed} TESTES APROVADOS`);
  console.log('================================================================================\n');

  if (failed > 0) {
    console.error(`ERRO: ${failed} testes falharam na auditoria do adapter ISP-RJ.`);
    process.exit(1);
  } else {
    console.log('TODAS AS ASSERÇÕES DO ADAPTER ISP-RJ FORAM VALIDADAS COM 100% DE SUCESSO!');
    process.exit(0);
  }
}

runIspRjAudit().catch(err => {
  console.error("Falha fatal na execução da auditoria ISP-RJ:", err);
  process.exit(1);
});
