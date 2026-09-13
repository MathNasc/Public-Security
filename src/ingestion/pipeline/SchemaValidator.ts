/**
 * SchemaValidator.ts
 * Validador industrial de contratos de layout de datasets de segurança pública.
 * Distingue mudanças compatíveis (novas colunas não essenciais) de mudanças incompatíveis (que quebram parsing e exigem bloqueio).
 */

export interface SchemaValidationResult {
  valid: boolean;
  isBreakingChange: boolean;
  detectedFormat: string;
  matchedColumns: string[];
  missingRequiredColumns: string[];
  unknownColumns: string[];
  warnings: string[];
  error?: string;
}

export interface DatasetSchemaContract {
  datasetId: string;
  name: string;
  requiredColumns: string[][]; // Cada item é uma lista de aliases alternativos (ao menos 1 deve existir)
  optionalColumns?: string[];
  minExpectedColumns?: number;
}

export class SchemaValidator {
  /**
   * Catálogo de contratos de layout para datasets oficiais de São Paulo e padrões nacionais
   */
  private static readonly CONTRACTS: Record<string, DatasetSchemaContract> = {
    'ssp_sp_microdados': {
      datasetId: 'ssp_sp_microdados',
      name: 'SSP-SP Microdados Criminais Individuais',
      minExpectedColumns: 4,
      requiredColumns: [
        ['NUM_BO', 'NUMERO_BOLETIM', 'NUMERO_BOLETIM_DE_OCORRENCIA', 'NUM_BOLETIM', 'BO_ID', 'ID_DELEGACIA'],
        ['ANO_BO', 'ANO', 'DATAOCORRENCIA', 'DATA_OCORRENCIA_BO', 'DATA_FATO', 'DATA'],
        ['MUNICIPIO_ELABORACAO', 'CIDADE', 'MUNICIPIO', 'NOME_MUNICIPIO', 'MUNICÍPIO']
      ],
      optionalColumns: [
        'MES', 'MES_ANO_BO', 'RUBRICA', 'DESCR_CONDUTA', 'NATUREZA_APURADA', 'NATUREZA', 
        'LATITUDE', 'LONGITUDE', 'LOGRADOURO', 'NUMERO_LOGRADOURO', 'BAIRRO', 'DELEGACIA_NOME', 'DP'
      ]
    },
    'ssp_sp_indicadores': {
      datasetId: 'ssp_sp_indicadores',
      name: 'SSP-SP Indicadores Estatísticos Mensais por Município',
      minExpectedColumns: 2,
      requiredColumns: [
        ['MUNICIPIO', 'MUNICÍPIO', 'CIDADE', 'NOME_MUNICIPIO', 'REGIAO', 'DEINTER']
      ],
      optionalColumns: [
        'HOMICIDIO_DOLOSO', 'LATROCINIO', 'FURTO_OUTROS', 'ROUBO_OUTROS', 'TOTAL_ESTUPRO', 'VEICULOS', 'MES', 'ANO'
      ]
    }
  };

  /**
   * Normaliza um nome de coluna removendo acentuação, espaços e caracteres especiais para comparação robusta.
   */
  public static normalizeColumnName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/_+/g, '_');
  }

  /**
   * Valida o cabeçalho extraído contra o contrato do dataset.
   */
  public static validateHeaders(headers: string[], datasetType: 'microdados' | 'indicadores' | string = 'microdados'): SchemaValidationResult {
    if (!headers || headers.length === 0) {
      return {
        valid: false,
        isBreakingChange: true,
        detectedFormat: 'empty_or_null',
        matchedColumns: [],
        missingRequiredColumns: ['(Cabeçalho ausente ou arquivo vazio)'],
        unknownColumns: [],
        warnings: [],
        error: 'Cabeçalho vazio ou não detectável no arquivo.'
      };
    }

    const normalizedHeaders = headers.map(h => this.normalizeColumnName(h));
    const contractKey = datasetType.toLowerCase().includes('indicador') ? 'ssp_sp_indicadores' : 'ssp_sp_microdados';
    const contract = this.CONTRACTS[contractKey];

    const matchedColumns: string[] = [];
    const missingRequiredColumns: string[] = [];
    const warnings: string[] = [];

    // Checa colunas obrigatórias através dos grupos de alternativas
    for (const group of contract.requiredColumns) {
      const normalizedGroup = group.map(g => this.normalizeColumnName(g));
      const match = normalizedGroup.find(col => normalizedHeaders.some(h => {
        if (h === col) return true;
        if (h.startsWith(`${col}_`) || h.endsWith(`_${col}`) || h.includes(`_${col}_`)) return true;
        if (col.startsWith(`${h}_`) || col.endsWith(`_${h}`) || col.includes(`_${h}_`)) return true;
        return false;
      }));
      
      if (match) {
        matchedColumns.push(match);
      } else {
        missingRequiredColumns.push(group.join(' OU '));
      }
    }

    // Identifica colunas desconhecidas/novas (potencial evolução compatível)
    const knownNormalized = new Set([
      ...contract.requiredColumns.flat().map(c => this.normalizeColumnName(c)),
      ...(contract.optionalColumns || []).map(c => this.normalizeColumnName(c))
    ]);

    const unknownColumns = normalizedHeaders.filter(h => !knownNormalized.has(h));
    if (unknownColumns.length > 0) {
      warnings.push(`Detectadas ${unknownColumns.length} colunas adicionais não mapeadas no contrato base (Ex: ${unknownColumns.slice(0, 3).join(', ')}). Mudança classificada como compatível.`);
    }

    const minColumns = contract.minExpectedColumns || 2;
    if (normalizedHeaders.length < minColumns) {
      return {
        valid: false,
        isBreakingChange: true,
        detectedFormat: 'malformed_sparse_header',
        matchedColumns,
        missingRequiredColumns: missingRequiredColumns.length > 0 ? missingRequiredColumns : ['(Colunas insuficientes)'],
        unknownColumns,
        warnings,
        error: `Mudança incompatível de layout detectada: Arquivo possui apenas ${normalizedHeaders.length} colunas, menos que o mínimo esperado (${minColumns}). Estrutura corrompida.`
      };
    }

    const isBreakingChange = missingRequiredColumns.length > 0;

    if (isBreakingChange) {
      return {
        valid: false,
        isBreakingChange: true,
        detectedFormat: 'incompatible_schema_mutation',
        matchedColumns,
        missingRequiredColumns,
        unknownColumns,
        warnings,
        error: `Mudança incompatível de layout detectada: colunas obrigatórias ausentes [${missingRequiredColumns.join('; ')}]. Publicação bloqueada para evitar corrupção de dados.`
      };
    }

    return {
      valid: true,
      isBreakingChange: false,
      detectedFormat: contract.name,
      matchedColumns,
      missingRequiredColumns: [],
      unknownColumns,
      warnings
    };
  }
}
