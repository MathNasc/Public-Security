/**
 * Catálogo Oficial Completo de Fontes de Dados da SSP-SP
 * Baseado no portal oficial de transparência e dados abertos:
 * https://www.ssp.sp.gov.br/estatistica/dados-abertos
 * https://www.ssp.sp.gov.br/transparenciassp/
 */

export interface OfficialDatasetMeta {
  id: string;
  sourceId: 'SSP-SP';
  datasetType: 'MICRODADOS_CRIMINAIS' | 'MDIP' | 'SUBTRAIDOS' | 'HISTORICO_LEGADO' | 'AGREGADO_OFICIAL' | 'PRODUTIVIDADE';
  name: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  format: 'xlsx' | 'api_json' | 'aspx_html';
  relativeUrl: string;
  officialUrl: string;
  expectedColumnsCount?: number;
  coverage: '645_municipios' | 'capital' | 'estado';
  granularity: 'ocorrencia_bo' | 'vitima' | 'mensal_municipio';
  methodologyNote: string;
  isAutomatedDownload: boolean;
  isActive: boolean;
}

export const SSP_SP_OFFICIAL_CATALOG: OfficialDatasetMeta[] = [
  // 1. SÉRIE MODERNA DE MICRODADOS (SPDadosCriminais)
  {
    id: 'ssp_sp_microdados_2026',
    sourceId: 'SSP-SP',
    datasetType: 'MICRODADOS_CRIMINAIS',
    name: 'SP Dados Criminais 2026',
    description: 'Microdados oficiais de ocorrências criminais registradas em 2026 em todos os 645 municípios paulistas.',
    periodStart: '2026-01',
    periodEnd: '2026-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/spDados/SPDadosCriminais_2026.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/spDados/SPDadosCriminais_2026.xlsx',
    expectedColumnsCount: 30,
    coverage: '645_municipios',
    granularity: 'ocorrencia_bo',
    methodologyNote: 'Cada linha representa um fato/natureza apurada em Boletim de Ocorrência policial com competência territorial e administrativa discriminadas.',
    isAutomatedDownload: true,
    isActive: true
  },
  {
    id: 'ssp_sp_microdados_2025',
    sourceId: 'SSP-SP',
    datasetType: 'MICRODADOS_CRIMINAIS',
    name: 'SP Dados Criminais 2025',
    description: 'Microdados oficiais de ocorrências criminais consolidadas de 2025 dos 645 municípios.',
    periodStart: '2025-01',
    periodEnd: '2025-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/spDados/SPDadosCriminais_2025.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/spDados/SPDadosCriminais_2025.xlsx',
    expectedColumnsCount: 30,
    coverage: '645_municipios',
    granularity: 'ocorrencia_bo',
    methodologyNote: 'Série moderna pós-padronização com códigos IBGE e coordenadas.',
    isAutomatedDownload: true,
    isActive: true
  },
  {
    id: 'ssp_sp_microdados_2024',
    sourceId: 'SSP-SP',
    datasetType: 'MICRODADOS_CRIMINAIS',
    name: 'SP Dados Criminais 2024',
    description: 'Microdados oficiais de ocorrências criminais consolidadas de 2024 dos 645 municípios.',
    periodStart: '2024-01',
    periodEnd: '2024-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/spDados/SPDadosCriminais_2024.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/spDados/SPDadosCriminais_2024.xlsx',
    expectedColumnsCount: 30,
    coverage: '645_municipios',
    granularity: 'ocorrencia_bo',
    methodologyNote: 'Série moderna pós-padronização com códigos IBGE e coordenadas.',
    isAutomatedDownload: true,
    isActive: true
  },
  {
    id: 'ssp_sp_microdados_2023',
    sourceId: 'SSP-SP',
    datasetType: 'MICRODADOS_CRIMINAIS',
    name: 'SP Dados Criminais 2023',
    description: 'Microdados oficiais de ocorrências criminais consolidadas de 2023 dos 645 municípios.',
    periodStart: '2023-01',
    periodEnd: '2023-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/spDados/SPDadosCriminais_2023.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/spDados/SPDadosCriminais_2023.xlsx',
    expectedColumnsCount: 30,
    coverage: '645_municipios',
    granularity: 'ocorrencia_bo',
    methodologyNote: 'Série moderna pós-padronização com códigos IBGE e coordenadas.',
    isAutomatedDownload: true,
    isActive: true
  },
  {
    id: 'ssp_sp_microdados_2022',
    sourceId: 'SSP-SP',
    datasetType: 'MICRODADOS_CRIMINAIS',
    name: 'SP Dados Criminais 2022',
    description: 'Microdados oficiais de ocorrências criminais consolidadas de 2022 dos 645 municípios.',
    periodStart: '2022-01',
    periodEnd: '2022-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/spDados/SPDadosCriminais_2022.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/spDados/SPDadosCriminais_2022.xlsx',
    expectedColumnsCount: 30,
    coverage: '645_municipios',
    granularity: 'ocorrencia_bo',
    methodologyNote: 'Primeiro ano da série unificada moderna SPDadosCriminais.',
    isAutomatedDownload: true,
    isActive: true
  },

  // 2. BASE ESPECIALIZADA: MORTE DECORRENTE DE INTERVENÇÃO POLICIAL (MDIP)
  {
    id: 'ssp_sp_mdip_2013_2026',
    sourceId: 'SSP-SP',
    datasetType: 'MDIP',
    name: 'Morte Decorrente de Intervenção Policial (MDIP)',
    description: 'Base de dados oficial de mortes decorrentes de intervenção policial (polícia civil e militar) de 2013 a 2026.',
    periodStart: '2013-01',
    periodEnd: '2026-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/spDados/MDIP_2026.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/spDados/MDIP_2026.xlsx',
    expectedColumnsCount: 33,
    coverage: '645_municipios',
    granularity: 'vitima',
    methodologyNote: 'Cada linha representa uma vítima fatal em confronto policial. Contém corporação (PM/PC), situação (serviço/folga), dados demográficos e perfil.',
    isAutomatedDownload: true,
    isActive: true
  },

  // 3. BASES HISTÓRICAS LEGADAS (2013 - 2022)
  {
    id: 'ssp_sp_homicidio_legado',
    sourceId: 'SSP-SP',
    datasetType: 'HISTORICO_LEGADO',
    name: 'Homicídio Doloso - Histórico 2017 a 2022',
    description: 'Microdados históricos legados de homicídio doloso anteriores ao novo layout SPDados.',
    periodStart: '2017-01',
    periodEnd: '2022-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/dadosInconsistentes/Homicidio_2017_2022.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/dadosInconsistentes/Homicidio_2017_2022.xlsx',
    coverage: '645_municipios',
    granularity: 'vitima',
    methodologyNote: 'Base histórica especializada em vítimas de homicídio doloso.',
    isAutomatedDownload: true,
    isActive: false
  },
  {
    id: 'ssp_sp_feminicidio_legado',
    sourceId: 'SSP-SP',
    datasetType: 'HISTORICO_LEGADO',
    name: 'Feminicídio - Histórico 2015 a 2022',
    description: 'Microdados históricos de feminicídio desde a promulgação da Lei 13.104/2015 até 2022.',
    periodStart: '2015-03',
    periodEnd: '2022-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/dadosInconsistentes/Feminicidio_2015_2022.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/dadosInconsistentes/Feminicidio_2015_2022.xlsx',
    coverage: '645_municipios',
    granularity: 'vitima',
    methodologyNote: 'Microdados detalhados de feminicídio qualificado.',
    isAutomatedDownload: true,
    isActive: false
  },
  {
    id: 'ssp_sp_latrocinio_legado',
    sourceId: 'SSP-SP',
    datasetType: 'HISTORICO_LEGADO',
    name: 'Latrocínio - Histórico 2015 a 2022',
    description: 'Microdados históricos de roubo seguido de morte de 2015 a 2022.',
    periodStart: '2015-04',
    periodEnd: '2022-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/dadosInconsistentes/Latrocinio_2022.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/dadosInconsistentes/Latrocinio_2022.xlsx',
    coverage: '645_municipios',
    granularity: 'vitima',
    methodologyNote: 'Microdados de latrocínio da polícia civil paulista.',
    isAutomatedDownload: true,
    isActive: false
  },

  // 4. BENS SUBTRAÍDOS (CELULARES E VEÍCULOS)
  {
    id: 'ssp_sp_celulares_2026',
    sourceId: 'SSP-SP',
    datasetType: 'SUBTRAIDOS',
    name: 'Celulares Subtraídos 2026',
    description: 'Estatísticas e microdados de aparelhos celulares roubados ou furtados em SP em 2026.',
    periodStart: '2026-01',
    periodEnd: '2026-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/baseDados/celularesSub/CelularesSubtraidos_2026.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/celularesSub/CelularesSubtraidos_2026.xlsx',
    coverage: '645_municipios',
    granularity: 'ocorrencia_bo',
    methodologyNote: 'Contagem a nível de objeto subtraído (marca, modelo e local).',
    isAutomatedDownload: true,
    isActive: false
  },
  {
    id: 'ssp_sp_veiculos_2026',
    sourceId: 'SSP-SP',
    datasetType: 'SUBTRAIDOS',
    name: 'Veículos Subtraídos 2026',
    description: 'Estatísticas e microdados de veículos roubados ou furtados em SP em 2026.',
    periodStart: '2026-01',
    periodEnd: '2026-12',
    format: 'xlsx',
    relativeUrl: 'assets/estatistica/transparencia/baseDados/veiculosSub/VeiculosSubtraidos_2026.xlsx',
    officialUrl: 'https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub/VeiculosSubtraidos_2026.xlsx',
    coverage: '645_municipios',
    granularity: 'ocorrencia_bo',
    methodologyNote: 'Contagem de veículos roubados/furtados com dados de placa e modelo.',
    isAutomatedDownload: true,
    isActive: false
  },

  // 5. ENDPOINTS OFICIAIS AGREGADOS PARA RECONCILIAÇÃO ESTATÍSTICA
  {
    id: 'ssp_sp_api_agrupado_mensal',
    sourceId: 'SSP-SP',
    datasetType: 'AGREGADO_OFICIAL',
    name: 'API Oficial de Dados Mensais Agrupados SSP-SP',
    description: 'Endpoint JSON oficial consultado pela SSP-SP para publicação das estatísticas mensais por município e estado.',
    periodStart: '2001-01',
    periodEnd: '2026-12',
    format: 'api_json',
    relativeUrl: 'v1/OcorrenciasMensais/RecuperaDadosMensaisAgrupados',
    officialUrl: 'https://www.ssp.sp.gov.br/v1/OcorrenciasMensais/RecuperaDadosMensaisAgrupados',
    coverage: '645_municipios',
    granularity: 'mensal_municipio',
    methodologyNote: 'Fonte da verdade governamental para conferência e reconciliação dos 23 delitos divulgados mensalmente.',
    isAutomatedDownload: true,
    isActive: true
  }
];

export class SspCatalogService {
  static getAllDatasets(): OfficialDatasetMeta[] {
    return SSP_SP_OFFICIAL_CATALOG;
  }

  static getModernCrimeDatasets(): OfficialDatasetMeta[] {
    return SSP_SP_OFFICIAL_CATALOG.filter(d => d.datasetType === 'MICRODADOS_CRIMINAIS');
  }

  static getDatasetById(id: string): OfficialDatasetMeta | undefined {
    return SSP_SP_OFFICIAL_CATALOG.find(d => d.id === id);
  }

  static getMdipDataset(): OfficialDatasetMeta {
    return SSP_SP_OFFICIAL_CATALOG.find(d => d.datasetType === 'MDIP')!;
  }

  static getReconciliationEndpoint(): OfficialDatasetMeta {
    return SSP_SP_OFFICIAL_CATALOG.find(d => d.id === 'ssp_sp_api_agrupado_mensal')!;
  }
}
