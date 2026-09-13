/**
 * SourceProvenance.ts
 * Contrato formal para rastreabilidade, linhagem e proveniência de dados oficiais.
 */

export interface SourceProvenance {
  /** Identificador da fonte (ex: 'SSP-SP') */
  sourceId: string;
  /** Sigla da UF (ex: 'SP') */
  stateCode: string;
  /** Nome formal da instituição produtora (ex: 'Secretaria de Segurança Pública de São Paulo') */
  providerName: string;

  /** Tipo de conjunto de dados (ex: 'microdados_bo', 'indicadores_mensais') */
  datasetType: string;

  /** URL original de onde o arquivo oficial foi adquirido */
  sourceUrl?: string | null;
  /** Identificador do arquivo no RAW storage */
  sourceFileId?: string | null;

  /** Hash criptográfico SHA-256 do arquivo original */
  checksumSha256?: string | null;

  /** Timestamp da aquisição/download */
  downloadedAt?: Date | null;
  /** Data oficial de publicação pelo órgão emissor */
  publicationDate?: Date | null;

  /** ETag HTTP oficial para controle de cache e idempotência */
  etag?: string | null;
  /** Header Last-Modified retornado pelo servidor oficial */
  lastModified?: string | null;

  /** Flag indicando se provém de publicação oficial do Estado */
  isOfficialPublication: boolean;

  /** Nível de maturidade de evidência operacional (E0 a E7) */
  evidenceLevel?: 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7';
}
