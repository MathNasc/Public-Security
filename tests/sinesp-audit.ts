import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SinespAdapter } from '../src/ingestion/adapters/sinesp/SinespAdapter.js';
import { IngestionWorker } from '../src/ingestion/pipeline/Worker.js';
import { JobManager } from '../src/ingestion/pipeline/JobManager.js';
import { db } from '../src/db/index.js';
import { dataImports, securityIndicators } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';

async function runSinespAudit() {
  console.log("================================================================================");
  console.log("             AUDITORIA COMPLETA DE INTEGRAÇÃO SINESP (MJSP)");
  console.log("================================================================================\n");

  const adapter = new SinespAdapter();
  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`  [OK] ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`  [FAIL] ${name}:`, e.message);
    }
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  [OK] ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`  [FAIL] ${name}:`, e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Auditoria de Conexão Remota, Bloqueio e Metadados
  // ---------------------------------------------------------------------------
  console.log("--- 1. Auditoria de Conexão Remota e Bloqueio ---");

  await testAsync("Método download() rejeita explicitamente devido ao bloqueio da URL remota (sem fallback falso)", async () => {
    let threw = false;
    try {
      await adapter.download("/tmp/test_should_fail.csv");
    } catch (e: any) {
      threw = true;
      assert(e.message.includes("Download automatizado indisponível"), "Mensagem deve explicar a indisponibilidade do download");
      assert(e.message.includes("dados.mj.gov.br") || e.message.includes("dados.gov.br"), "Mensagem deve citar os portais federais");
    }
    assert.strictEqual(threw, true, "download() deve lançar erro e não simular sucesso");
  });

  test("Metadados refletem com precisão o bloqueio, granularidade e limitações", () => {
    const meta = adapter.metadata();
    assert.strictEqual(meta.coverage, "Nacional (27 UFs)");
    assert(meta.limitations.some(l => l.includes("Download automatizado direto BLOQUEADO")), "Deve documentar o bloqueio remoto");
    assert(meta.limitations.some(l => l.includes("security_indicators")), "Deve explicitar uso restrito a indicadores");
    assert(meta.limitations.some(l => l.includes("duplicidade")), "Deve alertar sobre risco de sobreposição");
  });

  // ---------------------------------------------------------------------------
  // 2. Validação de Schemas do SINESP (Quality Gate)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Validação de Schemas e Cabeçalhos (Quality Gate) ---");

  test("Schema padrão oficial SINESP é aceito", () => {
    const headers = ['UF', 'Município', 'Tipo Crime', 'Ano', 'Mês', 'Ocorrências'];
    const res = adapter.validateSchema(headers);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.format, 'indicators');
  });

  test("Schema com Código IBGE e Vítimas é aceito", () => {
    const headers = ['Região', 'Sigla UF', 'Município', 'Código IBGE', 'Tipo Crime', 'Mês/Ano', 'Vítimas'];
    const res = adapter.validateSchema(headers);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.format, 'indicators');
  });

  test("Schema com acentuação e caixa alta/baixa é tolerado", () => {
    const headers = ['uf', 'MUNICÍPIO', 'tipo_crime', 'ANO', 'mês', 'total'];
    const res = adapter.validateSchema(headers);
    assert.strictEqual(res.valid, true);
  });

  test("Schema incompleto é rejeitado pelo Quality Gate", () => {
    const corruptedHeaders = ['UF', 'Município', 'Ano']; // Falta Tipo Crime, Mês, Ocorrências
    const res = adapter.validateSchema(corruptedHeaders);
    assert.strictEqual(res.valid, false);
    assert(res.missingColumns && res.missingColumns.length > 0);
  });

  // ---------------------------------------------------------------------------
  // 3. Normalização de Categorias Criminais e Resiliência
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Normalização de Categorias Criminais ---");

  test("Mapeia crimes violentos letais intencionais", () => {
    assert.strictEqual(adapter.normalize("Homicídio doloso"), "homicide");
    assert.strictEqual(adapter.normalize("Feminicídio"), "homicide");
    assert.strictEqual(adapter.normalize("Latrocínio"), "homicide");
    assert.strictEqual(adapter.normalize("Roubo seguido de morte"), "homicide");
    assert.strictEqual(adapter.normalize("Lesão corporal seguida de morte"), "homicide");
  });

  test("Mapeia crimes contra o patrimônio e veículos", () => {
    assert.strictEqual(adapter.normalize("Roubo de veículo"), "vehicle_robbery");
    assert.strictEqual(adapter.normalize("Furto de veículo"), "vehicle_theft");
    assert.strictEqual(adapter.normalize("Roubo de carga"), "cargo_theft");
    assert.strictEqual(adapter.normalize("Roubo a instituição financeira"), "robbery");
    assert.strictEqual(adapter.normalize("Roubo - outros"), "robbery");
    assert.strictEqual(adapter.normalize("Furto - outros"), "theft");
  });

  test("Mapeia crimes sexuais, drogas e lesões", () => {
    assert.strictEqual(adapter.normalize("Estupro"), "sexual_crime");
    assert.strictEqual(adapter.normalize("Estupro de vulnerável"), "sexual_crime");
    assert.strictEqual(adapter.normalize("Tráfico de drogas"), "drug_related");
    assert.strictEqual(adapter.normalize("Tráfico de entorpecentes"), "drug_related");
    assert.strictEqual(adapter.normalize("Tentativa de homicídio"), "assault");
    assert.strictEqual(adapter.normalize("Lesão corporal dolosa"), "bodily_harm");
  });

  test("Rubricas desconhecidas são tratadas sem lançar erro, mapeadas para 'other'", () => {
    const unknown = adapter.normalize("Contravenção Penal Diversa Não Catalogada");
    assert.strictEqual(unknown, "other");
  });

  // ---------------------------------------------------------------------------
  // 4. Parsing Resiliente de Linhas
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Parsing de Linhas, Meses, Anos e Valores ---");

  test("Parsing de linha padrão SINESP com meses por extenso", () => {
    const row = {
      'UF': 'SP',
      'Município': 'São Paulo',
      'Tipo Crime': 'Homicídio doloso',
      'Ano': '2024',
      'Mês': 'janeiro',
      'Ocorrências': '45'
    };
    const parsed = adapter.parseRow(row);
    assert(parsed !== null);
    assert.strictEqual(parsed.target, 'indicators', "Deve ser estritamente indicators");
    assert.strictEqual(parsed.data.stateCode, 'SP');
    assert.strictEqual(parsed.data.municipalityName, 'São Paulo');
    assert.strictEqual(parsed.data.municipalityCode, '3550308', "Deve resolver IBGE de São Paulo");
    assert.strictEqual(parsed.data.category, 'homicide');
    assert.strictEqual(parsed.data.period, '2024-01');
    assert.strictEqual(parsed.data.value, 45);
    assert.strictEqual(parsed.data.unit, 'occurrences');
  });

  test("Parsing com Código IBGE presente explicitamente na coluna", () => {
    const row = {
      'Sigla UF': 'RJ',
      'Município': 'Niterói',
      'Código IBGE': '3303302',
      'Tipo Crime': 'Roubo de veículo',
      'Ano': '2024',
      'Mês': 'fevereiro',
      'Ocorrências': '120'
    };
    const parsed = adapter.parseRow(row);
    assert(parsed !== null);
    assert.strictEqual(parsed.data.municipalityCode, '3303302', "Deve capturar o código IBGE direto da coluna");
    assert.strictEqual(parsed.data.period, '2024-02');
    assert.strictEqual(parsed.data.category, 'vehicle_robbery');
  });

  test("Parsing de formatos de período combinados (MM/YYYY e MesTexto/YYYY)", () => {
    const row1 = {
      'UF': 'MG',
      'Município': 'Belo Horizonte',
      'Tipo Crime': 'Furto de veículo',
      'Mês/Ano': '03/2024',
      'Ocorrências': '350'
    };
    const parsed1 = adapter.parseRow(row1);
    assert(parsed1 !== null);
    assert.strictEqual(parsed1.data.period, '2024-03');

    const row2 = {
      'UF': 'BA',
      'Município': 'Salvador',
      'Tipo Crime': 'Roubo de carga',
      'Mês/Ano': 'ABR/2024',
      'Vítimas': '15'
    };
    const parsed2 = adapter.parseRow(row2);
    assert(parsed2 !== null);
    assert.strictEqual(parsed2.data.period, '2024-04');
    assert.strictEqual(parsed2.data.unit, 'victims', "Coluna Vítimas deve registrar unit=victims");
  });

  test("Parsing com separadores numéricos de milhar e valores nulos/vazios", () => {
    const row = {
      'UF': 'SP',
      'Município': 'Campinas',
      'Tipo Crime': 'Roubo - outros',
      'Ano': '2024',
      'Mês': '05',
      'Ocorrências': '1.250'
    };
    const parsed = adapter.parseRow(row);
    assert(parsed !== null);
    assert.strictEqual(parsed.data.value, 1250, "Ponto de milhar deve ser removido");

    const rowEmpty = {
      'UF': 'SP',
      'Município': 'Campinas',
      'Tipo Crime': 'Roubo a banco',
      'Ano': '2024',
      'Mês': '05',
      'Ocorrências': '-'
    };
    const parsedEmpty = adapter.parseRow(rowEmpty);
    assert(parsedEmpty !== null);
    assert.strictEqual(parsedEmpty.data.value, 0, "Traço '-' deve ser convertido para 0");
  });

  test("Rejeita linhas inválidas ou corrompidas", () => {
    const rowCorrupted = {
      'UF': '',
      'Município': 'São Paulo',
      'Tipo Crime': 'Homicídio doloso',
      'Ano': 'não_é_ano',
      'Mês': 'janeiro'
    };
    assert.strictEqual(adapter.parseRow(rowCorrupted), null);
  });

  // ---------------------------------------------------------------------------
  // 5. Teste de Ingestão no Pipeline Real e Segregação Multi-Fonte
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Ingestão no Pipeline, Idempotência e Segregação Multi-Fonte ---");

  let createdJobId: string | null = null;

  await testAsync("Processa arquivo SINESP real via Worker e grava em security_indicators", async () => {
    const fixturePath = path.join(process.cwd(), 'raw_storage/indicadores_municipais/2024-01/sinesp_sample.csv');
    assert(fs.existsSync(fixturePath), "Fixture sinesp_sample.csv deve existir");
    const fileStat = fs.statSync(fixturePath);
    const fileBuf = fs.readFileSync(fixturePath);
    const checksum = crypto.createHash('sha256').update(fileBuf).digest('hex');

    const worker = new IngestionWorker('test-sinesp-worker');

    // Cria Job via JobManager oficial
    const jobResult = await JobManager.createJob({
      sourceId: 'SINESP',
      datasetId: 'indicadores_municipais',
      rawFilePath: fixturePath,
      originalFilename: 'sinesp_sample.csv',
      checksum: checksum + '_test_' + Date.now(),
      fileSize: fileStat.size,
      force: true
    });

    createdJobId = jobResult.jobId;
    const [dbJob] = await db.select().from(dataImports).where(eq(dataImports.id, createdJobId));
    assert(!!dbJob, "Job deve existir no banco");

    const res = await worker.processJobDirectly(dbJob);
    assert.strictEqual(res.success, true, "Job SINESP deve ser processado com sucesso");
    assert(res.metrics.recordsValid > 0, "Deve conter registros válidos");

    // Valida se os dados foram persistidos na tabela security_indicators
    const saved = await db
      .select()
      .from(securityIndicators)
      .where(
        and(
          eq(securityIndicators.sourceId, 'SINESP'),
          eq(securityIndicators.period, '2024-01')
        )
      );

    assert(saved.length >= 4, "Deve persistir indicadores válidos do lote");
    console.log(`    Indicadores SINESP persistidos: ${saved.length}`);
  });

  await testAsync("Idempotência: Reprocessar o mesmo arquivo não duplica indicadores", async () => {
    assert(createdJobId !== null, "Deve ter jobId anterior");
    const worker = new IngestionWorker('test-sinesp-worker-2');

    // Contagem inicial
    const countBefore = (await db.select().from(securityIndicators).where(eq(securityIndicators.sourceId, 'SINESP'))).length;

    const reprocessJob = await JobManager.reprocessJob(createdJobId);
    assert(!!reprocessJob && !!reprocessJob.job, "Job para reprocessamento deve ser criado");

    const res2 = await worker.processJobDirectly(reprocessJob.job);
    assert.strictEqual(res2.success, true, "Reprocessamento deve concluir com sucesso");

    // Contagem pós-reprocessamento
    const countAfter = (await db.select().from(securityIndicators).where(eq(securityIndicators.sourceId, 'SINESP'))).length;
    assert.strictEqual(countAfter, countBefore, "A contagem deve ser idêntica (idempotência garantida)");

    // Limpeza de jobs de teste
    await db.delete(dataImports).where(eq(dataImports.id, reprocessJob.job.id));
    if (createdJobId) {
      await db.delete(dataImports).where(eq(dataImports.id, createdJobId));
    }
  });

  await testAsync("Segregação de Fontes: Dados SINESP não colidem nem sobrescrevem dados SSP-SP", async () => {
    const sinespSP = await db
      .select()
      .from(securityIndicators)
      .where(
        and(
          eq(securityIndicators.sourceId, 'SINESP'),
          eq(securityIndicators.stateCode, 'SP')
        )
      );

    const sspSP = await db
      .select()
      .from(securityIndicators)
      .where(
        and(
          eq(securityIndicators.sourceId, 'SSP-SP'),
          eq(securityIndicators.stateCode, 'SP')
        )
      );

    assert(sinespSP.length > 0, "Deve haver indicadores SINESP para SP");
    assert(sspSP.length > 0, "Deve haver indicadores SSP-SP para SP");

    // Confirma que cada registro possui seu sourceId estritamente segregado
    assert(sinespSP.every(r => r.sourceId === 'SINESP'));
    assert(sspSP.every(r => r.sourceId === 'SSP-SP'));
    console.log(`    Segregação confirmada: SINESP-SP (${sinespSP.length} registros) vs SSP-SP (${sspSP.length} registros)`);
  });

  // ---------------------------------------------------------------------------
  // Resumo Final
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`              RESULTADO DA AUDITORIA: ${passed}/${total} ASSERÇÕES APROVADAS`);
  console.log("================================================================================\n");

  if (passed === total) {
    console.log("STATUS: TODAS AS VALIDAÇÕES DO SINESP FORAM BEM-SUCEDIDAS.");
  } else {
    process.exit(1);
  }
}

runSinespAudit().catch(err => {
  console.error("FATAL ERROR NO TESTE AUDIT SINESP:", err);
  process.exit(1);
});
