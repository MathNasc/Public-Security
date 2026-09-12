export type StateCode = string;
export type DatasetCategory = string;

/**
 * Defines which source is considered the primary, most reliable, or most granular
 * data source for a given state and category.
 * If a state has a direct SSP integration, we prefer it over SINESP.
 */
export function getPrimarySource(state: StateCode, category?: DatasetCategory): string {
  // If we have direct state integrations, prefer the state SSP/SES/SEGUP source over national aggregates.
  const statePreferredSources: Record<string, string> = {
    'SP': 'SSP-SP',
    'RJ': 'ISP-RJ',
    'MG': 'SSP-MG',
    'PR': 'SESP-PR',
    'RS': 'SSP-RS',
    'SC': 'SSP-SC',
    'BA': 'SSP-BA',
    'PE': 'SDS-PE',
    'CE': 'SSPDS-CE',
    'DF': 'SSP-DF',
    'GO': 'SSP-GO',
  };

  return statePreferredSources[state] || 'SINESP'; // Fallback to SINESP for unintegrated states
}

/**
 * Can be used in API layers to filter out duplicate universes.
 * Example: `WHERE source_id = getPrimarySource(state_code, category)`
 */
