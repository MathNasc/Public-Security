import { db } from '../src/db/index.js';
import { securityOccurrences, securityIndicators } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { PipelineAutomationService } from '../src/ingestion/orchestration/PipelineAutomationService.js';
import crypto from 'crypto';

async function runIndicatorAggregationAudit() {
  console.log('================================================================================');
  console.log('AUDITORIA DE PERSISTÊNCIA E UPSERT DE INDICADORES AGREGADOS');
  console.log('================================================================================');

  const testState = 'SP';
  const testMuniCode = '3550308'; // São Paulo
  const testCategory = 'robbery';
  const testSourceId = 'SSP-SP';
  const testYear = 2026;
  const testMonth = 8;
  const testPeriod = '2026-08';

  // Cleanup prévio do ambiente de teste
  await db.delete(securityIndicators).where(
    and(
      eq(securityIndicators.sourceId, testSourceId),
      eq(securityIndicators.municipalityCode, testMuniCode),
      eq(securityIndicators.category, testCategory),
      eq(securityIndicators.period, testPeriod)
    )
  );

  await db.delete(securityOccurrences).where(
    and(
      eq(securityOccurrences.stateCode, testState),
      eq(securityOccurrences.municipalityCode, testMuniCode),
      eq(securityOccurrences.category, testCategory),
      eq(securityOccurrences.year, testYear),
      eq(securityOccurrences.month, testMonth)
    )
  );

  // STEP 1: Inserir 3 ocorrências
  console.log('[PASSO 1] Inserindo 3 ocorrências no banco de dados...');
  for (let i = 1; i <= 3; i++) {
    await db.insert(securityOccurrences).values({
      id: crypto.randomUUID(),
      sourceId: testSourceId,
      datasetId: 'ocorrencias_sp',
      sourceRecordId: `TEST-OCC-${i}`,
      stateCode: testState,
      municipalityCode: testMuniCode,
      municipalityName: 'São Paulo',
      category: testCategory,
      year: testYear,
      month: testMonth,
      occurredAt: new Date(2026, 7, 15),
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoNothing();
  }

  // STEP 2: Executar recálculo e agregação de indicadores
  console.log('[PASSO 2] Executando PipelineAutomationService.recalculateIndicatorsForState("SP")...');
  await PipelineAutomationService.recalculateIndicatorsForState(testState);

  // STEP 3: Consultar security_indicators e validar persistência
  const indResult1 = await db.select().from(securityIndicators).where(
    and(
      eq(securityIndicators.sourceId, testSourceId),
      eq(securityIndicators.municipalityCode, testMuniCode),
      eq(securityIndicators.category, testCategory),
      eq(securityIndicators.period, testPeriod)
    )
  );

  if (indResult1.length === 0) {
    throw new Error('FALHA: Nenhum registro de indicador foi persistido na tabela security_indicators.');
  }

  const value1 = indResult1[0].value;
  console.log(`[PASS] Indicador persistido em security_indicators com sucesso! Valor calculado: ${value1} (esperado: 3).`);
  if (value1 !== 3) {
    throw new Error(`FALHA: Valor incorreto no indicador. Esperado 3, obtido ${value1}`);
  }

  // STEP 4: Inserir mais 2 ocorrências e re-executar recálculo (Testar UPSERT)
  console.log('[PASSO 4] Inserindo mais 2 ocorrências para testar UPSERT (total deve ir para 5)...');
  for (let i = 4; i <= 5; i++) {
    await db.insert(securityOccurrences).values({
      id: crypto.randomUUID(),
      sourceId: testSourceId,
      datasetId: 'ocorrencias_sp',
      sourceRecordId: `TEST-OCC-${i}`,
      stateCode: testState,
      municipalityCode: testMuniCode,
      municipalityName: 'São Paulo',
      category: testCategory,
      year: testYear,
      month: testMonth,
      occurredAt: new Date(2026, 7, 16),
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoNothing();
  }

  await PipelineAutomationService.recalculateIndicatorsForState(testState);

  // STEP 5: Consultar e validar valor atômico atualizado via UPSERT
  const indResult2 = await db.select().from(securityIndicators).where(
    and(
      eq(securityIndicators.sourceId, testSourceId),
      eq(securityIndicators.municipalityCode, testMuniCode),
      eq(securityIndicators.category, testCategory),
      eq(securityIndicators.period, testPeriod)
    )
  );

  const value2 = indResult2[0].value;
  console.log(`[PASS] UPSERT de indicador re-executado com sucesso! Valor atualizado: ${value2} (esperado: 5).`);
  if (value2 !== 5) {
    throw new Error(`FALHA: Valor incorreto após UPSERT. Esperado 5, obtido ${value2}`);
  }

  // Cleanup pós-teste
  await db.delete(securityIndicators).where(
    and(
      eq(securityIndicators.sourceId, testSourceId),
      eq(securityIndicators.municipalityCode, testMuniCode),
      eq(securityIndicators.category, testCategory),
      eq(securityIndicators.period, testPeriod)
    )
  );
  await db.delete(securityOccurrences).where(
    and(
      eq(securityOccurrences.stateCode, testState),
      eq(securityOccurrences.municipalityCode, testMuniCode),
      eq(securityOccurrences.category, testCategory),
      eq(securityOccurrences.year, testYear),
      eq(securityOccurrences.month, testMonth)
    )
  );

  console.log('================================================================================');
  console.log('SUCESSO: Auditoria de Agregação e UPSERT em security_indicators APROVADA!');
  console.log('================================================================================');
}

runIndicatorAggregationAudit().catch((err) => {
  console.error('ERRO NA AUDITORIA DE INDICADORES:', err);
  process.exit(1);
});
