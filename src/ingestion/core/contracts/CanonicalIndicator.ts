/**
 * CanonicalIndicator.ts
 * Contrato canônico para indicadores estatísticos criminais agregados por município e período.
 * Compatível com a tabela security_indicators e extensível a qualquer Estado da federação.
 */

export interface CanonicalIndicator {
  /** Identificador da fonte oficial (ex: 'SSP-SP', 'SINESP', 'ISP-RJ') */
  sourceId: string;
  /** Sigla da UF com 2 caracteres (ex: 'SP', 'RS', 'BA') */
  stateCode: string;

  /** Código IBGE de 7 dígitos do município correspondente */
  municipalityCode: string;

  /** Categoria canônica nacional normalizada (ex: 'homicide', 'theft', 'robbery') */
  category: string;
  /** Subcategoria canônica normalizada (ex: 'theft_vehicle', 'robbery_pedestrian') */
  subcategory?: string | null;

  /** Período de competência do indicador no formato AAAA-MM ou AAAA (ex: '2026-01') */
  period: string;

  /** Valor numérico absoluto apurado */
  value: number;

  /** Unidade de medida (padrão: 'count' / ocorrências) */
  unit?: string;

  /** Nível de agregação territorial ('municipality', 'state', 'national') */
  granularity?: 'municipality' | 'state' | 'national';

  /** Categoria original literal da fonte (ex: 'HOMICÍDIO DOLOSO (EXCLUI FEMINICÍDIO)') */
  sourceCategory?: string | null;
  /** Subcategoria/detalhamento original literal da fonte */
  sourceSubcategory?: string | null;

  /** População municipal de referência para o cálculo de taxas per capita */
  populationReference?: number | null;

  /** ID do arquivo físico original persistido no RAW storage */
  sourceFileId?: string | null;
  /** ID do job de ingestão correspondente */
  ingestionJobId?: string | null;
}
