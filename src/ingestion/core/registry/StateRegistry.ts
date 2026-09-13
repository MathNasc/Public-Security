/**
 * StateRegistry.ts
 * Registry central de Provedores Estaduais (State Providers).
 * Responsável por gerenciar o ciclo de vida e consulta de adapters sem acoplamento a estados específicos.
 */

import { StateProvider, StateDefinition, BRAZILIAN_STATES_REGISTRY } from '../contracts/index.js';

export class StateRegistry {
  private static providers: Map<string, StateProvider> = new Map();

  /**
   * Registra um novo State Provider no ecossistema
   */
  public static register(provider: StateProvider): void {
    if (!provider || !provider.stateCode) {
      throw new Error("Impossível registrar StateProvider sem stateCode válido.");
    }
    const code = provider.stateCode.toUpperCase().trim();
    this.providers.set(code, provider);
  }

  /**
   * Resolve o StateProvider a partir do código do Estado (UF).
   * Retorna null se não houver provedor registrado para a UF.
   */
  public static resolveProviderByState(stateCode: string): StateProvider | null {
    if (!stateCode || typeof stateCode !== 'string') return null;
    const clean = stateCode.toUpperCase().trim();
    return this.providers.get(clean) || null;
  }

  /**
   * Alias canônico para consulta por código de UF
   */
  public static get(stateCode: string): StateProvider | undefined {
    return this.resolveProviderByState(stateCode) || undefined;
  }

  /**
   * Resolve o StateProvider a partir de um sourceId oficial (ex: 'SSP-SP', 'SSP-SP-HISTORICAL')
   * Retorna null se não houver correspondência determinística.
   */
  public static resolveProviderBySource(sourceId: string): StateProvider | null {
    if (!sourceId || typeof sourceId !== 'string') return null;
    const cleanId = sourceId.toUpperCase().trim();
    
    // 1. Mapeamento direto se o sourceId contiver a sigla exata de um provider registrado
    for (const [code, provider] of this.providers.entries()) {
      if (cleanId === code || cleanId === provider.providerName.toUpperCase()) {
        return provider;
      }
      if (cleanId.startsWith(`${code}-`) || cleanId.endsWith(`-${code}`) || cleanId.includes(`_${code}_`) || cleanId.startsWith(`SSP-${code}`)) {
        return provider;
      }
      const datasets = provider.getDatasets?.() || [];
      if (datasets.some(d => d.id.toUpperCase() === cleanId || d.name.toUpperCase().includes(cleanId))) {
        return provider;
      }
    }

    // 2. Procura pelo nome do provider
    for (const provider of this.providers.values()) {
      if (provider.providerName.toUpperCase().includes(cleanId)) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Alias de compatibilidade para resolveProviderBySource
   */
  public static resolveBySource(sourceId: string): StateProvider | undefined {
    return this.resolveProviderBySource(sourceId) || undefined;
  }

  /**
   * Resolve a sigla da UF (stateCode) a partir do sourceId de forma explícita e determinística
   * Retorna null se a fonte for desconhecida ou não mapeada.
   */
  public static resolveStateBySource(sourceId: string): string | null {
    if (!sourceId || typeof sourceId !== 'string') return null;
    const cleanId = sourceId.toUpperCase().trim();

    // 1. Tenta resolver via provider registrado
    const provider = this.resolveProviderBySource(cleanId);
    if (provider) return provider.stateCode;

    // 2. Resolução explícita por padrão de nomenclatura governamental brasileiro
    const tokens = cleanId.split(/[-_/\s]+/);
    for (const token of tokens) {
      if (token.length === 2 && BRAZILIAN_STATES_REGISTRY[token]) {
        return token;
      }
    }

    if (cleanId.endsWith('-SP') || cleanId.startsWith('SSP-SP') || cleanId === 'SP') return 'SP';
    if (cleanId.endsWith('-RJ') || cleanId.startsWith('ISP-RJ') || cleanId === 'RJ') return 'RJ';
    if (cleanId.endsWith('-MG') || cleanId.startsWith('SSP-MG') || cleanId === 'MG') return 'MG';
    if (cleanId.endsWith('-RS') || cleanId.startsWith('SSP-RS') || cleanId === 'RS') return 'RS';
    if (cleanId.endsWith('-PR') || cleanId.startsWith('SESP-PR') || cleanId === 'PR') return 'PR';
    if (cleanId.endsWith('-SC') || cleanId.startsWith('SSP-SC') || cleanId === 'SC') return 'SC';
    if (cleanId.endsWith('-BA') || cleanId.startsWith('SSP-BA') || cleanId === 'BA') return 'BA';

    return null;
  }

  /**
   * Verifica se o Estado possui um State Provider ativo e registrado
   */
  public static isStateSupported(stateCode: string): boolean {
    if (!stateCode || typeof stateCode !== 'string') return false;
    const clean = stateCode.toUpperCase().trim();
    return this.providers.has(clean);
  }

  /**
   * Alias para isStateSupported
   */
  public static has(stateCode: string): boolean {
    return this.isStateSupported(stateCode);
  }

  /**
   * Retorna os State Providers com flag enabled = true na definição estadual
   */
  public static getActiveProviders(): StateProvider[] {
    return Array.from(this.providers.values()).filter(p => {
      const def = BRAZILIAN_STATES_REGISTRY[p.stateCode];
      return def ? def.enabled : true;
    });
  }

  /**
   * Lista todos os State Providers registrados
   */
  public static list(): StateProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Alias de list() para listar todos os State Providers registrados
   */
  public static listAll(): StateProvider[] {
    return this.list();
  }

  /**
   * Lista as definições e metadados de todos os Estados mapeados
   */
  public static listDefinitions(): StateDefinition[] {
    return Object.values(BRAZILIAN_STATES_REGISTRY);
  }

  /**
   * Retorna a definição canônica de um Estado com código IBGE
   */
  public static getStateDefinition(stateCode: string): StateDefinition | undefined {
    if (!stateCode || typeof stateCode !== 'string') return undefined;
    return BRAZILIAN_STATES_REGISTRY[stateCode.toUpperCase().trim()];
  }

  /**
   * Limpa o registry (utilizado exclusivamente em testes)
   */
  public static clear(): void {
    this.providers.clear();
  }
}

