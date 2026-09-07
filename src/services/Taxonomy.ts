export type CanonicalCategory =
  | 'homicide'
  | 'robbery'
  | 'theft'
  | 'vehicle_robbery'
  | 'vehicle_theft'
  | 'bodily_harm'
  | 'sexual_crime'
  | 'drug_related'
  | 'property_crime'
  | 'violent_crime'
  | 'other'
  | 'unknown';

export type CategoryGroup = 'violent' | 'property' | 'vehicle' | 'other';

export const TAXONOMY_VERSION = "2.0";

export function getCategoryGroup(category: CanonicalCategory | string): CategoryGroup {
  switch (category) {
    case 'homicide':
    case 'latrocinio':
    case 'bodily_harm':
    case 'sexual_crime':
    case 'violent_crime':
    case 'homicidio_doloso': // Legacy
    case 'homicidio': // Legacy
      return 'violent';
    
    case 'robbery':
    case 'theft':
    case 'property_crime':
    case 'furto': // Legacy
    case 'roubo': // Legacy
      return 'property';
      
    case 'vehicle_robbery':
    case 'vehicle_theft':
    case 'furto_veiculo': // Legacy
    case 'roubo_veiculo': // Legacy
      return 'vehicle';
      
    default:
      return 'other';
  }
}

export function normalizeLegacyCategory(legacy: string): CanonicalCategory {
  switch (legacy) {
    case 'homicidio_doloso':
    case 'homicidio':
      return 'homicide';
    case 'latrocinio':
      return 'homicide'; // Technically robbery resulting in death, mapped to homicide for simplicity in MVP, or 'violent_crime'
    case 'roubo':
      return 'robbery';
    case 'furto':
      return 'theft';
    case 'roubo_veiculo':
      return 'vehicle_robbery';
    case 'furto_veiculo':
      return 'vehicle_theft';
    default:
      return 'other';
  }
}
