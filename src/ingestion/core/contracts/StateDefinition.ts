/**
 * StateDefinition.ts
 * Definição canônica de metadados estaduais com código IBGE.
 */

export interface StateDefinition {
  /** Sigla oficial da UF com 2 caracteres (ex: 'SP') */
  code: string;
  /** Código IBGE de 2 dígitos do Estado (ex: 35 para SP) */
  ibgeCode: number;
  /** Nome completo do Estado */
  name: string;
  /** Nome oficial do órgão ou secretaria de segurança pública estadual */
  agency?: string;
  /** Flag indicando se o Estado possui State Provider ativo no sistema */
  enabled: boolean;
  /** Identificador do State Provider primário */
  primaryProviderId: string;
}

/** Catálogo canônico de Estados Brasileiros com código IBGE */
export const BRAZILIAN_STATES_REGISTRY: Record<string, StateDefinition> = {
  SP: {
    code: 'SP',
    ibgeCode: 35,
    name: 'São Paulo',
    agency: 'Secretaria de Segurança Pública de São Paulo (SSP-SP)',
    enabled: true,
    primaryProviderId: 'SSP-SP'
  },
  RJ: {
    code: 'RJ',
    ibgeCode: 33,
    name: 'Rio de Janeiro',
    agency: 'Instituto de Segurança Pública do Rio de Janeiro (ISP-RJ)',
    enabled: false,
    primaryProviderId: 'ISP-RJ'
  },
  RS: {
    code: 'RS',
    ibgeCode: 43,
    name: 'Rio Grande do Sul',
    agency: 'Secretaria de Segurança Pública do RS (SSP-RS)',
    enabled: false,
    primaryProviderId: 'SSP-RS'
  },
  MG: {
    code: 'MG',
    ibgeCode: 31,
    name: 'Minas Gerais',
    agency: 'Secretaria de Estado de Justiça e Segurança Pública (SEJUSP-MG)',
    enabled: false,
    primaryProviderId: 'SSP-MG'
  },
  BA: {
    code: 'BA',
    ibgeCode: 29,
    name: 'Bahia',
    agency: 'Secretaria da Segurança Pública da Bahia (SSP-BA)',
    enabled: false,
    primaryProviderId: 'SSP-BA'
  },
  PR: {
    code: 'PR',
    ibgeCode: 41,
    name: 'Paraná',
    agency: 'Secretaria da Segurança Pública do Paraná (SESP-PR)',
    enabled: false,
    primaryProviderId: 'SESP-PR'
  },
  SC: {
    code: 'SC',
    ibgeCode: 42,
    name: 'Santa Catarina',
    agency: 'Secretaria de Estado da Segurança Pública de SC (SSP-SC)',
    enabled: false,
    primaryProviderId: 'SSP-SC'
  }
};
