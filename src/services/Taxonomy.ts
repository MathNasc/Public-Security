export type CanonicalCategory =
  | 'homicide'
  | 'robbery'
  | 'theft'
  | 'vehicle_robbery'
  | 'vehicle_theft'
  | 'cargo_theft'
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
    case 'cargo_theft':
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

export function normalizeLegacyCategoryFix(legacy: string): CanonicalCategory {
  const l = legacy.toLowerCase();
  if (l.includes('veículo')) return 'vehicle_theft';
  if (l.includes('pessoa')) return 'robbery';
  if (l.includes('violento')) return 'violent_crime';
  return 'other';
}

export function getCategoryGroupFix(category: CanonicalCategory | string): CategoryGroup {
  if (category === 'vehicle_theft' || category === 'vehicle_robbery') return 'vehicle';
  if (category === 'robbery' || category === 'theft') return 'property';
  if (category === 'violent_crime' || category === 'homicide') return 'violent';
  return 'other';
}
