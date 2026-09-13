import { StateRegistry } from '../core/index.js';

export type StateCode = string;
export type DatasetCategory = string;

/**
 * Define qual fonte é a primária/preferencial para um determinado Estado.
 * Não utiliza fallbacks silenciosos para São Paulo quando o Estado for outro.
 */
export function getPrimarySource(state: StateCode, category?: DatasetCategory): string | null {
  if (!state) return null;
  const cleanState = state.toUpperCase().trim();

  // 1. Consulta StateRegistry
  const stateDef = StateRegistry.getStateDefinition(cleanState);
  if (stateDef && stateDef.primaryProviderId) {
    return stateDef.primaryProviderId;
  }

  const provider = StateRegistry.get(cleanState);
  if (provider) {
    if (typeof provider.getStateDefinition === 'function') {
      const def = provider.getStateDefinition();
      if (def?.primaryProviderId) return def.primaryProviderId;
    }
    return `SSP-${cleanState}`;
  }

  // 2. Mapeamento declarativo oficial por secretaria estadual
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

  return statePreferredSources[cleanState] || null;
}


/**
 * Can be used in API layers to filter out duplicate universes.
 * Example: `WHERE source_id = getPrimarySource(state_code, category)`
 */
