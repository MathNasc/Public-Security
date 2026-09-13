/**
 * StateProvider.ts
 * Contrato principal da abstração de Provedores Estaduais de Segurança Pública.
 * Define capacidades explícitas e métodos declarativos sem acoplamento a órgãos específicos.
 */

import { CanonicalOccurrence } from './CanonicalOccurrence.js';
import { CanonicalIndicator } from './CanonicalIndicator.js';
import { StateDataset } from './StateDataset.js';
import { TaxonomyMapping } from './TaxonomyMapping.js';
import { SourceProvenance } from './SourceProvenance.js';
import { StateDefinition } from './StateDefinition.js';

export interface ProviderCapabilities {
  /** Fornece microdados de Boletins de Ocorrência individuais? */
  occurrences: boolean;
  /** Fornece indicadores estatísticos agregados por município? */
  indicators: boolean;
  /** Possui coordenadas geográficas (lat/lon) nos microdados? */
  coordinates: boolean;
  /** Disponibiliza série histórica de anos anteriores? */
  historicalData: boolean;
  /** Disponibiliza atualizações em frequência mensal? */
  monthlyData: boolean;
  /** Permite download automático por endpoint ou API pública? */
  automatedDownload: boolean;
}

export interface StateProvider {
  /** Sigla oficial da UF atendida (ex: 'SP') */
  readonly stateCode: string;
  /** Código IBGE de 2 dígitos do Estado (ex: 35) */
  readonly ibgeStateCode: number;
  /** Nome descritivo do Estado (ex: 'São Paulo') */
  readonly stateName: string;
  /** Nome oficial do órgão/provedor (ex: 'SSP-SP') */
  readonly providerName: string;

  /** Matriz explícita de capacidades operacionais */
  readonly capabilities: ProviderCapabilities;

  /** Retorna a definição e metadados estaduais oficiais */
  getStateDefinition?(): StateDefinition;

  /** Lista os conjuntos de dados suportados pelo provedor */
  getDatasets(): StateDataset[];

  /** Descoberta da última versão/publicação oficial disponível */
  discover(): Promise<{
    version: string;
    url?: string;
    period?: string;
    checksum?: string;
  }>;

  /** Gera a chave natural única de um registro para deduplicação idempotente */
  getNaturalKey?(record: any): string;

  /** Normaliza uma linha bruta da fonte para o contrato canônico de Ocorrência */
  normalizeOccurrence?(record: any): CanonicalOccurrence | null;

  /** Normaliza uma linha bruta da fonte para o contrato canônico de Indicador */
  normalizeIndicator?(record: any): CanonicalIndicator | CanonicalIndicator[] | null;

  /** Retorna o catálogo oficial de mapeamento taxonômico do Estado */
  getTaxonomyMappings?(): TaxonomyMapping[];

  /** Executa reconciliação de integridade entre ocorrências e indicadores oficiais */
  reconcile?(period: string): Promise<{
    period: string;
    passed: boolean;
    differences: Array<{
      category: string;
      occurrencesCount: number;
      indicatorsCount: number;
      delta: number;
    }>;
  }>;

  /** Retorna a proveniência oficial do conjunto de dados */
  getProvenance?(datasetId: string): SourceProvenance;
}
