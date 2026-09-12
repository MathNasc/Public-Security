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
  const c = category.toLowerCase();
  if (c.includes('veiculo') || c.includes('veículo') || c === 'vehicle_theft' || c === 'vehicle_robbery' || c === 'cargo_theft') return 'vehicle';
  if (c.includes('roubo') || c.includes('furto') || c === 'robbery' || c === 'theft' || c === 'property_crime') return 'property';
  if (c.includes('homicidio') || c.includes('homicídio') || c.includes('morte') || c.includes('estupro') || c.includes('sexual') || c.includes('lesao') || c.includes('lesão') || c === 'violent_crime' || c === 'homicide' || c === 'bodily_harm' || c === 'sexual_crime') return 'violent';
  return 'other';
}

export function normalizeLegacyCategory(legacy: string): CanonicalCategory {
  if (!legacy) return 'other';
  const l = legacy.toLowerCase().trim();
  
  // Directly recognize canonical keys
  if (l === 'theft') return 'theft';
  if (l === 'robbery') return 'robbery';
  if (l === 'vehicle_theft') return 'vehicle_theft';
  if (l === 'vehicle_robbery') return 'vehicle_robbery';
  if (l === 'cargo_theft') return 'cargo_theft';
  if (l === 'homicide') return 'homicide';
  if (l === 'bodily_harm') return 'bodily_harm';
  if (l === 'sexual_crime') return 'sexual_crime';
  if (l === 'drug_related') return 'drug_related';
  if (l === 'property_crime') return 'property_crime';
  if (l === 'violent_crime') return 'violent_crime';

  if (l.includes('cvli') || l.includes('homicidio') || l.includes('homicídio') || l.includes('latrocínio') || l.includes('latrocinio') || l.includes('letal') || l.includes('morte decorrente')) return 'homicide';
  if (l.includes('carga')) return 'cargo_theft';
  if (l.includes('veículo') || l.includes('veiculo') || l.includes('auto')) {
    if (l.includes('roubo') || l === 'roubo_veiculo') return 'vehicle_robbery';
    return 'vehicle_theft';
  }
  if (l.includes('cvp') || l.includes('patrimonio') || l.includes('patrimonial')) return 'property_crime';
  if (l.includes('furto')) return 'theft';
  if (l.includes('roubo') || l.includes('pessoa') || l.includes('transeunte') || l.includes('comercio') || l.includes('residencia')) return 'robbery';
  if (l.includes('violento') || l.includes('violência') || l.includes('violencia')) return 'violent_crime';
  if (l.includes('sexual') || l.includes('estupro') || l.includes('vulneravel') || l.includes('vulnerável') || l.includes('mulher')) return 'sexual_crime';
  if (l.includes('drogas') || l.includes('trafico') || l.includes('tráfico') || l.includes('entorpecente') || l.includes('porte de entorpecentes')) return 'drug_related';
  if (l.includes('lesão') || l.includes('lesao')) return 'bodily_harm';
  
  return 'other';
}

export function normalizeLegacyCategoryFix(legacy: string): CanonicalCategory {
  return normalizeLegacyCategory(legacy);
}

export function getCategoryGroupFix(category: CanonicalCategory | string): CategoryGroup {
  return getCategoryGroup(category);
}
