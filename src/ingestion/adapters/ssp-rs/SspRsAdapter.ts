import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord, SchemaValidationResult } from '../BaseAdapter.js';
import { CanonicalCategory } from '../../../services/Taxonomy.js';
import crypto from 'crypto';

interface RsCrimeMapping {
  key: string;
  category: CanonicalCategory;
  subcategory?: string;
  unit: string;
}

const RS_CRIME_DEFINITIONS: RsCrimeMapping[] = [
  // Crimes letais intencionais / contra a vida
  { key: 'homicidio doloso', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'homicidio_doloso', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'latrocinio', category: 'homicide', subcategory: 'latrocinio', unit: 'vitimas' },
  { key: 'feminicidio', category: 'homicide', subcategory: 'feminicidio', unit: 'vitimas' },
  { key: 'lesao corporal seguida de morte', category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },
  { key: 'lesao_morte', category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },

  // Crimes contra a pessoa / integridade física
  { key: 'tentativa de homicidio', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'tentativa_homicidio', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'homicidio tentado', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'lesao corporal', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },
  { key: 'lesao_corporal', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },

  // Crimes sexuais
  { key: 'estupro', category: 'sexual_crime', subcategory: 'estupro', unit: 'vitimas' },
  { key: 'estupro de vulneravel', category: 'sexual_crime', subcategory: 'estupro_vulneravel', unit: 'vitimas' },
  { key: 'tentativa de estupro', category: 'sexual_crime', subcategory: 'tentativa_estupro', unit: 'ocorrencias' },

  // Crimes contra o patrimônio - Veículos
  { key: 'roubo de veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo_veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'furto de veiculo', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto_veiculo', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },

  // Crimes contra o patrimônio - Carga
  { key: 'roubo de carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },
  { key: 'roubo_carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },

  // Roubos diversos
  { key: 'roubo', category: 'robbery', subcategory: 'roubo_geral', unit: 'ocorrencias' },
  { key: 'roubo a pedestre', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo_pedestre', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo a estabelecimento comercial', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo_comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo a residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'roubo_residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'roubo a transporte coletivo', category: 'robbery', subcategory: 'roubo_transporte_coletivo', unit: 'ocorrencias' },
  { key: 'extorsao', category: 'robbery', subcategory: 'extorsao', unit: 'ocorrencias' },

  // Furtos diversos
  { key: 'furto', category: 'theft', subcategory: 'furto_geral', unit: 'ocorrencias' },
  { key: 'furto qualificado', category: 'theft', subcategory: 'furto_qualificado', unit: 'ocorrencias' },
  { key: 'abigeato', category: 'theft', subcategory: 'abigeato', unit: 'ocorrencias' },

  // Drogas e entorpecentes
  { key: 'trafico de entorpecentes', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'trafico_entorpecentes', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'posse de entorpecentes', category: 'drug_related', subcategory: 'posse_drogas', unit: 'ocorrencias' },
  { key: 'posse_entorpecentes', category: 'drug_related', subcategory: 'posse_drogas', unit: 'ocorrencias' },
  { key: 'apreensao de drogas', category: 'drug_related', subcategory: 'apreensao_drogas', unit: 'ocorrencias' },

  // Outros delitos
  { key: 'delitos relacionados a armas e municoes', category: 'other', subcategory: 'armas_municoes', unit: 'ocorrencias' },
  { key: 'delitos_armas_municoes', category: 'other', subcategory: 'armas_municoes', unit: 'ocorrencias' },
  { key: 'estelionato', category: 'other', subcategory: 'estelionato', unit: 'ocorrencias' },
  { key: 'outros delitos', category: 'other', subcategory: 'outros', unit: 'ocorrencias' }
];

const RS_MONTH_NAMES_MAP: Record<string, number> = {
  'janeiro': 1, 'jan': 1, '01': 1, '1': 1,
  'fevereiro': 2, 'fev': 2, '02': 2, '2': 2,
  'marco': 3, 'mar': 3, '03': 3, '3': 3,
  'abril': 4, 'abr': 4, '04': 4, '4': 4,
  'maio': 5, 'mai': 5, '05': 5, '5': 5,
  'junho': 6, 'jun': 6, '06': 6, '6': 6,
  'julho': 7, 'jul': 7, '07': 7, '7': 7,
  'agosto': 8, 'ago': 8, '08': 8, '8': 8,
  'setembro': 9, 'set': 9, '09': 9, '9': 9,
  'outubro': 10, 'out': 10, '10': 10,
  'novembro': 11, 'nov': 11, '11': 11,
  'dezembro': 12, 'dez': 12, '12': 12
};

/**
 * Adapter oficial para SSP-RS (Secretaria da Segurança Pública do Estado do Rio Grande do Sul).
 * Suporta os formatos oficiais consolidados por município (matriciais) e tabelas verticalizadas.
 */
export class SspRsAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Secretaria da Segurança Pública do Rio Grande do Sul - SSP-RS",
      agency: "SSP-RS",
      frequency: "Mensal",
      coverage: "RS",
      limitations: [
        "Dados agregados por município e mês apurado pela Divisão de Estatística e Inteligência Policial (DEI)",
        "Fechamento oficial mensal publicado até o 15º dia útil subsequente",
        "Suporta formatos matriciais (crimes em colunas) e desdobrados por indicador"
      ]
    };
  }

  identifyVersion(): string {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  }

  async discover(): Promise<DiscoveryResult> {
    const version = this.identifyVersion();
    const url = `https://ssp.rs.gov.br/indicadores-criminais`;

    return {
      source: "SSP-RS",
      dataset: "indicadores_municipais_rs",
      url,
      version,
      checksum: crypto.createHash('sha256').update(`ssp-rs-${version}`).digest('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    console.log(`[SSP-RS Adapter] Ingestão pronta para ${destinationPath}`);
    return destinationPath;
  }

  /**
   * Quality Gate / Validação de Schema
   */
  validateSchema(headers: string[]): SchemaValidationResult {
    const cleanHeaders = headers.map(h => 
      h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    const hasLocation = cleanHeaders.some(h => 
      ['cod_ibge', 'codigo_ibge', 'ibge', 'municipio', 'nome_municipio', 'cidade'].includes(h)
    );
    const hasYear = cleanHeaders.some(h => ['ano', 'year'].includes(h));
    const hasMonth = cleanHeaders.some(h => ['mes', 'month', 'periodo'].includes(h));

    // Formato 1: Wide (colunas de crimes)
    const hasWideCols = cleanHeaders.some(h => 
      ['homicidio_doloso', 'homicidio doloso', 'latrocinio', 'feminicidio', 'roubo_veiculo', 'roubo de veiculo', 'furto_veiculo', 'furto de veiculo', 'roubo', 'furto', 'estupro'].includes(h)
    );

    if (hasLocation && hasYear && hasMonth && hasWideCols) {
      return {
        valid: true,
        format: 'indicators',
        detectedColumns: cleanHeaders
      };
    }

    // Formato 2: Vertical (coluna de indicador/crime)
    const hasNatureza = cleanHeaders.some(h => ['natureza', 'crime', 'delito', 'indicador', 'fato'].includes(h));
    const hasValueCol = cleanHeaders.some(h => ['total', 'frequencia', 'ocorrencias', 'vitimas', 'quantidade', 'registros'].includes(h));

    if (hasLocation && hasYear && hasMonth && hasNatureza && hasValueCol) {
      return {
        valid: true,
        format: 'indicators',
        detectedColumns: cleanHeaders
      };
    }

    const missing: string[] = [];
    if (!hasLocation) missing.push('cod_ibge / municipio');
    if (!hasYear) missing.push('ano');
    if (!hasMonth) missing.push('mes');
    if (!hasWideCols && !hasNatureza) missing.push('colunas de crimes ou natureza/indicador');

    return {
      valid: false,
      error: `Schema incompatível para SSP-RS. Colunas ausentes: ${missing.join(', ')}`,
      missingColumns: missing
    };
  }

  /**
   * Mapeamento de texto penal para categoria canônica nacional.
   */
  mapCrimeToCanonical(naturezaStr: string): CanonicalCategory {
    const clean = (naturezaStr || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const found = RS_CRIME_DEFINITIONS.find(m => m.key === clean || clean.includes(m.key));
    if (found) return found.category;

    if (clean.includes('homicidio') || clean.includes('morte') || clean.includes('latrocinio') || clean.includes('feminicidio')) return 'homicide';
    if (clean.includes('veiculo') && clean.includes('roubo')) return 'vehicle_robbery';
    if (clean.includes('veiculo') && clean.includes('furto')) return 'vehicle_theft';
    if (clean.includes('carga')) return 'cargo_theft';
    if (clean.includes('estupro') || clean.includes('sexual')) return 'sexual_crime';
    if (clean.includes('lesao') || clean.includes('agressao')) return 'bodily_harm';
    if (clean.includes('entorpecente') || clean.includes('droga') || clean.includes('toxico')) return 'drug_related';
    if (clean.includes('roubo') || clean.includes('pedestre')) return 'robbery';
    if (clean.includes('furto') || clean.includes('abigeato')) return 'theft';

    return 'other';
  }

  /**
   * Parsing linha a linha.
   */
  parseRow(row: any): ParsedRecord[] | null {
    if (!row || typeof row !== 'object') return null;

    const normalizedRow: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      normalizedRow[cleanKey] = row[key];
    }

    // Identificação temporal
    const rawAno = normalizedRow['ano'] || normalizedRow['year'];
    const rawMes = normalizedRow['mes'] || normalizedRow['month'];
    if (!rawAno || !rawMes) return null;

    const ano = parseInt(String(rawAno).replace(/\D/g, ''), 10);
    let mesNum = 0;
    const cleanMesStr = String(rawMes).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (RS_MONTH_NAMES_MAP[cleanMesStr]) {
      mesNum = RS_MONTH_NAMES_MAP[cleanMesStr];
    } else {
      mesNum = parseInt(cleanMesStr.replace(/\D/g, ''), 10);
    }

    if (isNaN(ano) || ano < 1990 || ano > 2100) return null;
    if (isNaN(mesNum) || mesNum < 1 || mesNum > 12) return null;

    const periodStr = `${ano}-${String(mesNum).padStart(2, '0')}`;

    // Identificação geográfica
    const rawIbge = normalizedRow['cod_ibge'] || normalizedRow['codigo_ibge'] || normalizedRow['ibge'];
    let municipalityCode: string | null = null;
    if (rawIbge) {
      const digits = String(rawIbge).replace(/\D/g, '');
      if (digits.length === 6 || digits.length === 7) {
        municipalityCode = digits;
      }
    }

    const municipalityName = normalizedRow['municipio'] || normalizedRow['nome_municipio'] || normalizedRow['cidade'] || null;

    const records: ParsedRecord[] = [];

    // CASO 1: Formato Vertical
    const rawNatureza = normalizedRow['natureza'] || normalizedRow['indicador'] || normalizedRow['crime'] || normalizedRow['delito'] || normalizedRow['fato'];
    if (rawNatureza) {
      const naturezaStr = String(rawNatureza).trim();
      const canonicalCategory = this.mapCrimeToCanonical(naturezaStr);

      const cleanNaturezaKey = naturezaStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const def = RS_CRIME_DEFINITIONS.find(d => d.key === cleanNaturezaKey || cleanNaturezaKey.includes(d.key));
      const subcategory = def?.subcategory || cleanNaturezaKey.replace(/\s+/g, '_');
      const unit = def?.unit || 'ocorrencias';

      const rawVal = normalizedRow['total'] ?? normalizedRow['frequencia'] ?? normalizedRow['ocorrencias'] ?? normalizedRow['vitimas'] ?? normalizedRow['quantidade'] ?? normalizedRow['registros'];
      let numVal = 0;
      if (typeof rawVal === 'number') {
        numVal = rawVal;
      } else if (rawVal !== undefined && rawVal !== null) {
        const cleanStr = String(rawVal).trim().replace(/\./g, '').replace(',', '.');
        if (cleanStr === '-' || cleanStr.toUpperCase() === 'N/D' || cleanStr.toUpperCase() === 'ND') {
          numVal = 0;
        } else {
          const parsed = parseFloat(cleanStr);
          numVal = isNaN(parsed) ? 0 : parsed;
        }
      }

      if (numVal >= 0) {
        records.push({
          target: 'indicators',
          data: {
            id: crypto.randomUUID(),
            sourceId: 'SSP-RS',
            datasetId: 'indicadores_municipais_rs',
            stateCode: 'RS',
            stateName: 'Rio Grande do Sul',
            municipalityCode: municipalityCode,
            municipalityName: municipalityName,
            category: canonicalCategory,
            subcategory: subcategory,
            sourceCategory: naturezaStr,
            period: periodStr,
            value: numVal,
            unit: unit,
            granularity: 'municipality',
            sourceData: null
          }
        });
      }

      return records.length > 0 ? records : null;
    }

    // CASO 2: Formato Matricial / Wide (colunas de crimes)
    const handledCols = new Set<string>();

    for (const def of RS_CRIME_DEFINITIONS) {
      const keyWithUnderscore = def.key.replace(/\s+/g, '_');
      const keyWithSpace = def.key.replace(/_/g, ' ');

      let actualColKey: string | null = null;
      let rawVal: any = undefined;

      if (normalizedRow[def.key] !== undefined && normalizedRow[def.key] !== null && normalizedRow[def.key] !== '') {
        actualColKey = def.key;
        rawVal = normalizedRow[def.key];
      } else if (normalizedRow[keyWithUnderscore] !== undefined && normalizedRow[keyWithUnderscore] !== null && normalizedRow[keyWithUnderscore] !== '') {
        actualColKey = keyWithUnderscore;
        rawVal = normalizedRow[keyWithUnderscore];
      } else if (normalizedRow[keyWithSpace] !== undefined && normalizedRow[keyWithSpace] !== null && normalizedRow[keyWithSpace] !== '') {
        actualColKey = keyWithSpace;
        rawVal = normalizedRow[keyWithSpace];
      }

      if (actualColKey === null || rawVal === undefined || handledCols.has(actualColKey)) continue;
      handledCols.add(actualColKey);

      let numVal = 0;
      if (typeof rawVal === 'number') {
        numVal = rawVal;
      } else {
        const cleanStr = String(rawVal).trim().replace(/\./g, '').replace(',', '.');
        if (cleanStr === '-' || cleanStr.toUpperCase() === 'N/D') {
          numVal = 0;
        } else {
          const parsed = parseFloat(cleanStr);
          numVal = isNaN(parsed) ? 0 : parsed;
        }
      }

      if (numVal < 0) continue;

      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-RS',
          datasetId: 'indicadores_municipais_rs',
          stateCode: 'RS',
          stateName: 'Rio Grande do Sul',
          municipalityCode: municipalityCode,
          municipalityName: municipalityName,
          category: def.category,
          subcategory: def.subcategory,
          sourceCategory: actualColKey,
          period: periodStr,
          value: numVal,
          unit: def.unit,
          granularity: 'municipality',
          sourceData: null
        }
      });
    }

    return records.length > 0 ? records : null;
  }
}
