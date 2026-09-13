/**
 * CanonicalOccurrence.ts
 * Contrato canônico para dados de ocorrências criminais (microdados georreferenciados ou individuais).
 * Compatível com a tabela security_occurrences e extensível a qualquer Estado da federação.
 */

export type LocationPrecision = 'exact' | 'approximate' | 'municipality_centroid' | 'none';

export interface CanonicalOccurrence {
  /** Identificador da fonte oficial (ex: 'SSP-SP', 'ISP-RJ') */
  sourceId: string;
  /** Sigla da Unidade Federativa com 2 caracteres (ex: 'SP', 'RJ') */
  stateCode: string;

  /** Código IBGE de 7 dígitos do município da ocorrência */
  municipalityCode?: string | null;
  /** Nome descritivo do município */
  municipalityName?: string | null;

  /** Data e hora em que o fato criminoso ocorreu */
  occurredAt?: Date | null;
  /** Data e hora do registro do Boletim de Ocorrência */
  registeredAt?: Date | null;
  /** Período de referência estatística no formato AAAA-MM ou AAAA (ex: '2026-01') */
  referencePeriod?: string | null;

  /** Categoria canônica normalizada nacional (ex: 'theft', 'robbery', 'homicide') */
  category: string;
  /** Subcategoria canônica normalizada (ex: 'theft_vehicle', 'armed_robbery') */
  subcategory?: string | null;

  /** Categoria/natureza original literal extraída da fonte oficial (ex: 'FURTO - OUTROS', 'ROUBO DE CARGA') */
  sourceCategory?: string | null;
  /** Subcategoria/rubrica ou desdobramento original literal da fonte (ex: 'INTERIOR DE VEICULO') */
  sourceSubcategory?: string | null;

  /** Latitude WGS84 */
  latitude?: number | null;
  /** Longitude WGS84 */
  longitude?: number | null;

  /** Nível de precisão espacial */
  locationPrecision?: LocationPrecision;
  /** Flag obrigatória que sinaliza se o ponto foi gerado artificialmente (ex: centroide municipal) */
  isSyntheticPoint?: boolean;

  /** Identificador original do registro na fonte (ex: número do BO) */
  sourceRecordId?: string | null;
  /** Hash SHA-256 natural imutável do incidente para garantia de idempotência */
  incidentHash: string;

  /** Endereço original literal reportado na fonte */
  originalAddress?: string | null;

  /** Metadados RAW brutos da fonte serializados */
  sourceData?: Record<string, any> | string | null;

  /** ID do arquivo físico original persistido no RAW storage */
  sourceFileId?: string | null;
  /** ID do job de ingestão que processou o registro */
  ingestionJobId?: string | null;
}
