/**
 * StateDataset.ts
 * Abstração para definição dos conjuntos de dados disponibilizados por um Estado.
 */

export interface StateDataset {
  /** Identificador único do dataset (ex: 'ssp-sp-spdados-2026', 'ssp-sp-mensal') */
  id: string;
  /** Sigla da UF proprietária (ex: 'SP') */
  stateCode: string;
  /** Nome legível do dataset */
  name: string;
  /** Tipo do conjunto de dados */
  datasetType: 'microdata_bo' | 'monthly_indicators' | 'annual_report' | 'opendata_portal';
  /** Flag de ativação no ambiente */
  enabled: boolean;

  /** Suporta ocorrências individuais georreferenciadas? */
  supportsOccurrences: boolean;
  /** Suporta indicadores municipais agregados? */
  supportsIndicators: boolean;

  /** Cobertura temporal (ex: '2026') */
  temporalCoverage?: string;
  /** Cobertura geográfica (ex: 'Estado de São Paulo') */
  geographicCoverage?: string;

  /** Formato de arquivo fornecido pela fonte oficial */
  fileFormat?: 'xlsx' | 'csv' | 'json' | 'api' | 'zip';
  /** URL pública oficial de publicação */
  officialUrl?: string;
}
