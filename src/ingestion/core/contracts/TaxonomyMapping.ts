/**
 * TaxonomyMapping.ts
 * Contrato formal para mapeamento de naturezas/rubricas estaduais para a Taxonomia Canônica Nacional.
 * Regra de Ouro: Nunca inventar equivalências artificiais; 'unmapped' é um estado válido.
 */

export type MappingStatus = 'mapped' | 'partially_mapped' | 'unmapped';

export interface TaxonomyMapping {
  /** Sigla da UF do estado de origem (ex: 'SP', 'RJ', 'BA') */
  stateCode: string;
  /** Identificador da fonte oficial (ex: 'SSP-SP') */
  sourceId: string;

  /** Categoria/natureza original da fonte (ex: 'FURTO DE VEÍCULO') */
  sourceCategory: string;
  /** Subcategoria/desdobramento original da fonte (opcional) */
  sourceSubcategory?: string | null;

  /** Categoria canônica nacional mapeada (ex: 'theft') */
  canonicalCategory?: string | null;
  /** Subcategoria canônica nacional mapeada (ex: 'theft_vehicle') */
  canonicalSubcategory?: string | null;

  /** Status da correspondência taxonômica */
  mappingStatus: MappingStatus;

  /** Justificativa jurídica ou técnica da correspondência */
  notes?: string;
}
