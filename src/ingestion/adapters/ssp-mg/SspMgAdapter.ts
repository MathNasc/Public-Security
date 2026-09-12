import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord, SchemaValidationResult } from '../BaseAdapter.js';
import { CanonicalCategory } from '../../../services/Taxonomy.js';
import crypto from 'crypto';

/**
 * Mapeamento das rubricas e colunas oficiais de Minas Gerais (SEJUSP-MG) para a taxonomia canônica.
 */
interface MgCrimeMapping {
  key: string;
  category: CanonicalCategory;
  subcategory?: string;
  unit: string;
}

const MG_CRIME_DEFINITIONS: MgCrimeMapping[] = [
  // Crimes violentos letais intencionais e contra a vida
  { key: 'homicidio consumado', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'homicidio_consumado', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'latrocinio', category: 'homicide', subcategory: 'latrocinio', unit: 'vitimas' },
  { key: 'roubo seguido de morte', category: 'homicide', subcategory: 'latrocinio', unit: 'vitimas' },
  { key: 'lesao corporal seguida de morte', category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },
  { key: 'lesao_corp_morte', category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },

  // Crimes contra a pessoa / integridade física
  { key: 'homicidio tentado', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'homicidio_tentado', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'lesao corporal consumada', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },
  { key: 'lesao corporal', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },
  { key: 'lesao_corporal', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },

  // Crimes sexuais
  { key: 'estupro consumado', category: 'sexual_crime', subcategory: 'estupro', unit: 'vitimas' },
  { key: 'estupro_consumado', category: 'sexual_crime', subcategory: 'estupro', unit: 'vitimas' },
  { key: 'estupro de vulneravel consumado', category: 'sexual_crime', subcategory: 'estupro_vulneravel', unit: 'vitimas' },
  { key: 'estupro tentado', category: 'sexual_crime', subcategory: 'tentativa_estupro', unit: 'ocorrencias' },
  { key: 'estupro', category: 'sexual_crime', subcategory: 'estupro', unit: 'vitimas' },

  // Crimes contra o patrimônio - Veículos
  { key: 'roubo de veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo_veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'furto de veiculo', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto_veiculo', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },

  // Crimes contra o patrimônio - Carga
  { key: 'roubo de carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },
  { key: 'roubo_carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },

  // Roubos diversos
  { key: 'roubo consumado', category: 'robbery', subcategory: 'roubo_consumado', unit: 'ocorrencias' },
  { key: 'roubo_consumado', category: 'robbery', subcategory: 'roubo_consumado', unit: 'ocorrencias' },
  { key: 'roubo a transeunte', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo a estabelecimento comercial', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo a residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'roubo a instituicao financeira', category: 'robbery', subcategory: 'roubo_banco', unit: 'ocorrencias' },
  { key: 'roubo no transporte coletivo', category: 'robbery', subcategory: 'roubo_transporte_coletivo', unit: 'ocorrencias' },
  { key: 'extorsao mediante sequestro', category: 'robbery', subcategory: 'sequestro', unit: 'ocorrencias' },
  { key: 'extorsao', category: 'robbery', subcategory: 'extorsao', unit: 'ocorrencias' },
  { key: 'roubo', category: 'robbery', subcategory: 'roubo_geral', unit: 'ocorrencias' },

  // Furtos diversos
  { key: 'furto consumado', category: 'theft', subcategory: 'furto_consumado', unit: 'ocorrencias' },
  { key: 'furto_consumado', category: 'theft', subcategory: 'furto_consumado', unit: 'ocorrencias' },
  { key: 'furto a transeunte', category: 'theft', subcategory: 'furto_transeunte', unit: 'ocorrencias' },
  { key: 'furto', category: 'theft', subcategory: 'furto_geral', unit: 'ocorrencias' },

  // Drogas e entorpecentes
  { key: 'trafico de drogas', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'trafico de drogas consumado', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'uso e consumo de drogas', category: 'drug_related', subcategory: 'posse_drogas', unit: 'ocorrencias' },
  { key: 'apreensao de drogas', category: 'drug_related', subcategory: 'apreensao_drogas', unit: 'ocorrencias' },

  // Outros indicadores
  { key: 'armas de fogo apreendidas', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'armas_apreendidas', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'homicidio culposo no transito', category: 'other', subcategory: 'homicidio_culposo_transito', unit: 'ocorrencias' },
  { key: 'outros registros', category: 'other', subcategory: 'outros', unit: 'ocorrencias' }
];

const MONTH_NAMES_MAP: Record<string, number> = {
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
 * Adapter oficial para SEJUSP-MG / SSP-MG (Secretaria de Estado de Justiça e Segurança Pública de Minas Gerais).
 * Suporta formatos verticais (típicos do Portal de Dados Abertos de MG) e horizontais (consolidados por município).
 */
export class SspMgAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Secretaria de Estado de Justiça e Segurança Pública de Minas Gerais - SEJUSP-MG",
      agency: "SEJUSP-MG",
      frequency: "Mensal",
      coverage: "MG",
      limitations: [
        "Dados agregados mensalmente por município e regional de segurança (não contém microdados pontuais com latitude/longitude)",
        "Defasagem de fechamento e auditoria oficial entre 20 e 30 dias após o encerramento do mês apurado",
        "Suporta formatos verticalizados (natureza por linha) e matriciais (crimes em colunas)"
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
    const url = `http://dados.mg.gov.br/dataset/estatisticas-seguranca-publica-municipios`;

    return {
      source: "SSP-MG",
      dataset: "indicadores_municipais_mg",
      url,
      version,
      checksum: crypto.createHash('sha256').update(`ssp-mg-${version}`).digest('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    console.log(`[SEJUSP-MG Adapter] Stream de ingestão preparado para ${destinationPath}`);
    return destinationPath;
  }

  /**
   * Validação de Schema do arquivo antes do início do processamento.
   */
  validateSchema(headers: string[]): SchemaValidationResult {
    const cleanHeaders = headers.map(h => 
      h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    const hasLocation = cleanHeaders.some(h => 
      ['codigo_ibge', 'cod_ibge', 'ibge', 'municipio', 'nome_municipio', 'risp', 'aisp'].includes(h)
    );
    const hasYear = cleanHeaders.some(h => ['ano', 'year'].includes(h));
    const hasMonth = cleanHeaders.some(h => ['mes', 'month', 'mes_ano', 'periodo'].includes(h));
    
    // Formato 1: Vertical com coluna de natureza/fato
    const hasNatureza = cleanHeaders.some(h => ['natureza', 'fato', 'crime', 'delito', 'rubrica'].includes(h));
    const hasValueCol = cleanHeaders.some(h => ['registros', 'qtde ocorrencias', 'qtde_ocorrencias', 'quantidade', 'total', 'vitimas'].includes(h));

    if (hasLocation && hasYear && hasMonth && hasNatureza && hasValueCol) {
      return {
        valid: true,
        format: 'indicators',
        detectedColumns: cleanHeaders
      };
    }

    // Formato 2: Horizontal com múltiplas colunas criminais
    const hasWideCrimeCols = cleanHeaders.some(h => 
      ['homicidio_consumado', 'homicidio consumado', 'latrocinio', 'roubo_consumado', 'roubo consumado', 'furto_consumado', 'furto consumado', 'roubo_veiculo', 'furto_veiculo'].includes(h)
    );

    if (hasLocation && hasYear && hasMonth && hasWideCrimeCols) {
      return {
        valid: true,
        format: 'indicators',
        detectedColumns: cleanHeaders
      };
    }

    const missing: string[] = [];
    if (!hasLocation) missing.push('codigo_ibge / municipio');
    if (!hasYear) missing.push('ano');
    if (!hasMonth) missing.push('mes');
    if (!hasNatureza && !hasWideCrimeCols) missing.push('natureza ou colunas de crimes');

    return {
      valid: false,
      error: `Schema não reconhecido para SEJUSP-MG. Colunas esperadas ausentes: ${missing.join(', ')}`,
      missingColumns: missing
    };
  }

  /**
   * Mapeamento de texto/rubrica para taxonomia canônica.
   */
  mapCrimeToCanonical(naturezaStr: string): CanonicalCategory {
    const clean = (naturezaStr || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const found = MG_CRIME_DEFINITIONS.find(m => m.key === clean || clean.includes(m.key));
    if (found) return found.category;

    if (clean.includes('homicidio') || clean.includes('morte') || clean.includes('latrocinio')) return 'homicide';
    if (clean.includes('veiculo') && clean.includes('roubo')) return 'vehicle_robbery';
    if (clean.includes('veiculo') && clean.includes('furto')) return 'vehicle_theft';
    if (clean.includes('carga')) return 'cargo_theft';
    if (clean.includes('estupro') || clean.includes('sexual')) return 'sexual_crime';
    if (clean.includes('lesao') || clean.includes('agressao')) return 'bodily_harm';
    if (clean.includes('droga') || clean.includes('entorpecente') || clean.includes('toxico')) return 'drug_related';
    if (clean.includes('roubo')) return 'robbery';
    if (clean.includes('furto')) return 'theft';

    return 'other';
  }

  /**
   * Parsing linha a linha suportando tanto datasets verticais quanto horizontais da SEJUSP-MG.
   */
  parseRow(row: any): ParsedRecord[] | null {
    if (!row || typeof row !== 'object') return null;

    // Normaliza as chaves da linha para lowercase sem acentos
    const normalizedRow: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      normalizedRow[cleanKey] = row[key];
    }

    // Identificação de Ano e Mês
    const rawAno = normalizedRow['ano'] || normalizedRow['year'];
    const rawMes = normalizedRow['mes'] || normalizedRow['month'];

    if (!rawAno || !rawMes) return null;

    const ano = parseInt(String(rawAno).replace(/\D/g, ''), 10);
    let mesNum = 0;
    const cleanMesStr = String(rawMes).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (MONTH_NAMES_MAP[cleanMesStr]) {
      mesNum = MONTH_NAMES_MAP[cleanMesStr];
    } else {
      mesNum = parseInt(cleanMesStr.replace(/\D/g, ''), 10);
    }

    if (isNaN(ano) || ano < 1990 || ano > 2100) return null;
    if (isNaN(mesNum) || mesNum < 1 || mesNum > 12) return null;

    const periodStr = `${ano}-${String(mesNum).padStart(2, '0')}`;

    // Identificação de Localização
    const rawIbge = normalizedRow['codigo_ibge'] || normalizedRow['cod_ibge'] || normalizedRow['ibge'];
    let municipalityCode: string | null = null;
    if (rawIbge) {
      const digits = String(rawIbge).replace(/\D/g, '');
      if (digits.length === 6 || digits.length === 7) {
        municipalityCode = digits;
      }
    }

    const municipalityName = normalizedRow['municipio'] || normalizedRow['nome_municipio'] || normalizedRow['fmun_nome'] || null;
    const risp = normalizedRow['risp'] ? String(normalizedRow['risp']).trim() : null;

    const records: ParsedRecord[] = [];

    // CASO 1: Formato Vertical (coluna 'natureza' / 'fato')
    const rawNatureza = normalizedRow['natureza'] || normalizedRow['fato'] || normalizedRow['crime'] || normalizedRow['delito'];
    if (rawNatureza) {
      const naturezaStr = String(rawNatureza).trim();
      const canonicalCategory = this.mapCrimeToCanonical(naturezaStr);
      
      const cleanNaturezaKey = naturezaStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const def = MG_CRIME_DEFINITIONS.find(d => d.key === cleanNaturezaKey || cleanNaturezaKey.includes(d.key));
      const subcategory = def?.subcategory || cleanNaturezaKey.replace(/\s+/g, '_');
      const unit = def?.unit || 'ocorrencias';

      const rawVal = normalizedRow['registros'] ?? normalizedRow['qtde ocorrencias'] ?? normalizedRow['qtde_ocorrencias'] ?? normalizedRow['quantidade'] ?? normalizedRow['total'] ?? normalizedRow['vitimas'];
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
            sourceId: 'SSP-MG',
            datasetId: risp ? 'indicadores_risp_mg' : 'indicadores_municipais_mg',
            stateCode: 'MG',
            stateName: 'Minas Gerais',
            municipalityCode: municipalityCode,
            municipalityName: municipalityName,
            category: canonicalCategory,
            subcategory: subcategory,
            sourceCategory: naturezaStr,
            period: periodStr,
            value: numVal,
            unit: unit,
            granularity: risp ? 'regional' : 'municipality',
            sourceData: risp ? JSON.stringify({ risp }) : null
          }
        });
      }

      return records.length > 0 ? records : null;
    }

    // CASO 2: Formato Horizontal / Wide (várias colunas criminais)
    const handledCols = new Set<string>();

    for (const def of MG_CRIME_DEFINITIONS) {
      const keyWithUnderscore = def.key.replace(/\s+/g, '_');
      const keyWithSpace = def.key.replace(/_/g, ' ');
      
      // Encontra o valor em qualquer variação de grafia
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
          sourceId: 'SSP-MG',
          datasetId: risp ? 'indicadores_risp_mg' : 'indicadores_municipais_mg',
          stateCode: 'MG',
          stateName: 'Minas Gerais',
          municipalityCode: municipalityCode,
          municipalityName: municipalityName,
          category: def.category,
          subcategory: def.subcategory,
          sourceCategory: actualColKey,
          period: periodStr,
          value: numVal,
          unit: def.unit,
          granularity: risp ? 'regional' : 'municipality',
          sourceData: risp ? JSON.stringify({ risp }) : null
        }
      });
    }

    return records.length > 0 ? records : null;
  }
}
