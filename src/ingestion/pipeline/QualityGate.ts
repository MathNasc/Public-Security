/**
 * QualityGate.ts
 * Avaliador operacional de conformidade e integridade estatística de dados ingeridos.
 * Gera diagnósticos objetivos com base nas métricas da execução.
 */

export interface QualityEvaluationMetrics {
  recordsRead: number;
  recordsValid: number;
  recordsInvalid: number;
  recordsInserted: number;
  recordsDuplicate: number;
  recordsWithoutCoordinates: number;
  recordsWithInvalidCoordinates: number;
  recordsWithUnknownMunicipality: number;
}

export type QualityGateStatus = 'PASSED' | 'WARNING' | 'REJECTED';

export interface QualityGateEvaluation {
  status: QualityGateStatus;
  passed: boolean;
  score: number; // 0.0 a 1.0
  invalidRate: number; // 0 a 100%
  lossRate: number; // 0 a 100%
  coordinateCoverageRate: number; // 0 a 100%
  municipalityMatchRate: number; // 0 a 100%
  warnings: string[];
  rejectionReasons: string[];
}

export class QualityGate {
  // Limiares baseados no perfil operacional oficial de microdados e indicadores
  public static readonly MAX_ALLOWED_INVALID_RATE = 15; // 15% máximo de registros inválidos antes de warning
  public static readonly CRITICAL_INVALID_RATE = 50; // 50% ou mais gera rejeição do lote
  public static readonly CRITICAL_UNKNOWN_MUNI_RATE = 40; // Mais de 40% de municípios desconhecidos rejeita

  public static evaluate(metrics: QualityEvaluationMetrics): QualityGateEvaluation {
    const total = metrics.recordsRead;
    const warnings: string[] = [];
    const rejectionReasons: string[] = [];

    // Caso 1: Lote vazio (0 registros lidos)
    if (total === 0) {
      return {
        status: 'REJECTED',
        passed: false,
        score: 0,
        invalidRate: 100,
        lossRate: 100,
        coordinateCoverageRate: 0,
        municipalityMatchRate: 0,
        warnings: [],
        rejectionReasons: ['Quality Gate: Zero registros lidos no lote. Arquivo vazio ou ilegível.']
      };
    }

    const invalidRate = Number(((metrics.recordsInvalid / total) * 100).toFixed(2));
    const lossRate = Number((((total - metrics.recordsValid) / total) * 100).toFixed(2));
    
    const validCount = Math.max(metrics.recordsValid, 1);
    const withCoords = Math.max(0, metrics.recordsValid - metrics.recordsWithoutCoordinates - metrics.recordsWithInvalidCoordinates);
    const coordinateCoverageRate = Number(((withCoords / validCount) * 100).toFixed(2));

    const withMuni = Math.max(0, metrics.recordsValid - metrics.recordsWithUnknownMunicipality);
    const municipalityMatchRate = Number(((withMuni / validCount) * 100).toFixed(2));

    // Validações Críticas (Rejeição imediata)
    if (metrics.recordsValid === 0) {
      rejectionReasons.push('Quality Gate: 100% dos registros foram rejeitados por falha de formatação/schema.');
    }

    if (invalidRate >= this.CRITICAL_INVALID_RATE) {
      rejectionReasons.push(`Quality Gate: Taxa de registros inválidos (${invalidRate}%) excede o limite crítico (${this.CRITICAL_INVALID_RATE}%).`);
    }

    const unknownMuniRate = Number(((metrics.recordsWithUnknownMunicipality / validCount) * 100).toFixed(2));
    if (unknownMuniRate >= this.CRITICAL_UNKNOWN_MUNI_RATE) {
      rejectionReasons.push(`Quality Gate: Taxa de municípios não identificados (${unknownMuniRate}%) excede o limite crítico (${this.CRITICAL_UNKNOWN_MUNI_RATE}%).`);
    }

    // Validações de Alerta (Warning)
    if (invalidRate > this.MAX_ALLOWED_INVALID_RATE && invalidRate < this.CRITICAL_INVALID_RATE) {
      warnings.push(`Taxa de registros inválidos (${invalidRate}%) acima do patamar nominal de 15%.`);
    }

    const invalidCoordsRate = Number(((metrics.recordsWithInvalidCoordinates / validCount) * 100).toFixed(2));
    if (invalidCoordsRate > 2.0) {
      warnings.push(`Detectados ${metrics.recordsWithInvalidCoordinates} registros (${invalidCoordsRate}%) com coordenadas geográficas fora dos limites do Brasil/Estado.`);
    }

    if (metrics.recordsWithUnknownMunicipality > 0 && unknownMuniRate > 5.0 && unknownMuniRate < this.CRITICAL_UNKNOWN_MUNI_RATE) {
      warnings.push(`Detectados ${metrics.recordsWithUnknownMunicipality} registros (${unknownMuniRate}%) com município não mapeado no IBGE.`);
    }

    const duplicateRate = Number(((metrics.recordsDuplicate / validCount) * 100).toFixed(2));
    if (duplicateRate > 2.0) {
      warnings.push(`Detectados ${metrics.recordsDuplicate} registros duplicados (${duplicateRate}%) no mesmo lote.`);
    }

    // Cálculo do Score de Qualidade (0.0 a 1.0)
    let score = 1.0;
    score -= (invalidRate / 100) * 0.4;
    score -= (metrics.recordsWithUnknownMunicipality / validCount) * 0.3;
    score -= (metrics.recordsWithInvalidCoordinates / validCount) * 0.2;
    score = Number(Math.max(0, Math.min(1.0, score)).toFixed(2));

    let status: QualityGateStatus = 'PASSED';
    if (rejectionReasons.length > 0) {
      status = 'REJECTED';
    } else if (warnings.length > 0) {
      status = 'WARNING';
    }

    return {
      status,
      passed: status !== 'REJECTED',
      score,
      invalidRate,
      lossRate,
      coordinateCoverageRate,
      municipalityMatchRate,
      warnings,
      rejectionReasons
    };
  }
}
