/**
 * DataQuality.ts
 * Contrato comum para telemetria de qualidade e integridade de dados estaduais.
 */

export interface DataQuality {
  /** Cobertura geral do dataset */
  coverage: 'complete' | 'partial' | 'unknown';
  /** Intervalo temporal coberto (ex: '2010-2026') */
  temporalCoverage?: string;
  /** Escopo geográfico coberto (ex: 'Estado de São Paulo - 645 Municípios') */
  geographicCoverage?: string;

  /** Total de registros lidos no lote */
  recordsProcessed: number;
  /** Total de registros validados e aceitos pelo Quality Gate */
  recordsAccepted: number;
  /** Total de registros rejeitados por inconsistência de schema ou dados */
  recordsRejected: number;

  /** Porcentagem de registros com coordenadas geográficas válidas (0.0 a 1.0) */
  coordinateCoverage?: number;

  /** Status da reconciliação entre microdados e indicadores agregados */
  reconciliationStatus: 'passed' | 'partial' | 'failed' | 'not_available';
}
