export type StateCode = string;
export type DatasetCategory = string;

/**
 * Defines which source is considered the primary, most reliable, or most granular
 * data source for a given state and category.
 * If a state has a direct SSP integration, we prefer it over SINESP.
 */
export function getPrimarySource(state: StateCode, category: DatasetCategory): string {
  // If we have highly granular or direct SSP integrations for these states, prefer them.
  const statePreferredSources: Record<string, string> = {
    'SP': 'SSP-SP (sample_1788974125648.csv)',
    'RJ': 'ISP-RJ',
    'MG': 'SSP-MG'
  };

  return statePreferredSources[state] || 'SSP-SP (sample_1788974125648.csv)'; // Fallback to SINESP for unintegrated states
}

/**
 * Can be used in API layers to filter out duplicate universes.
 * Example: `WHERE source_id = getPrimarySource(state_code, category)`
 */
