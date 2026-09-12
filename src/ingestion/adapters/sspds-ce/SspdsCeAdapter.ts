import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord, SchemaValidationResult } from '../BaseAdapter.js';
import { CanonicalCategory } from '../../../services/Taxonomy.js';
import crypto from 'crypto';

interface CeCrimeMapping {
  key: string;
  category: CanonicalCategory;
  subcategory?: string;
  unit: string;
}

const CE_CRIME_DEFINITIONS: CeCrimeMapping[] = [
  // Crimes Violentos Letais Intencionais (CVLI) / Mortes Violentas
  { key: 'cvli', category: 'homicide', subcategory: 'cvli', unit: 'vitimas' },
  { key: 'crimes violentos letais intencionais', category: 'homicide', subcategory: 'cvli', unit: 'vitimas' },
  { key: 'homicidio doloso', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'homicidio_doloso', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'homicidio', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'latrocinio', category: 'homicide', subcategory: 'latrocinio', unit: 'vitimas' },
  { key: 'roubo seguido de morte', category: 'homicide', subcategory: 'latrocinio', unit: 'vitimas' },
  { key: 'feminicidio', category: 'homicide', subcategory: 'feminicidio', unit: 'vitimas' },
  { key: 'lesao corporal seguida de morte', category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },
  { key: 'lesao_morte', category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },

  // Integridade Física / Tentativas
  { key: 'tentativa de homicidio', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'tentativa_homicidio', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'homicidio tentado', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'lesao corporal dolosa', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },
  { key: 'lesao corporal', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },
  { key: 'lesao_corporal', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },

  // Dignidade Sexual
  { key: 'estupro', category: 'sexual_crime', subcategory: 'estupro', unit: 'vitimas' },
  { key: 'estupro de vulneravel', category: 'sexual_crime', subcategory: 'estupro_vulneravel', unit: 'vitimas' },
  { key: 'estupro_vulneravel', category: 'sexual_crime', subcategory: 'estupro_vulneravel', unit: 'vitimas' },
  { key: 'tentativa de estupro', category: 'sexual_crime', subcategory: 'tentativa_estupro', unit: 'ocorrencias' },
  { key: 'crimes contra a dignidade sexual', category: 'sexual_crime', subcategory: 'estupro', unit: 'vitimas' },

  // Crimes contra o Patrimônio - Veículos
  { key: 'roubo de veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo_veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo de veiculos', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo de auto', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo de moto', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'cvp veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'cvp_veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'furto de veiculo', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto_veiculo', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto de veiculos', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto de auto', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto de moto', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },

  // Crimes contra o Patrimônio - Carga
  { key: 'roubo de carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },
  { key: 'roubo_carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },
  { key: 'cvp carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },
  { key: 'cvp_carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },

  // Crimes Violentos contra o Patrimônio (CVP) / Roubos
  { key: 'cvp', category: 'robbery', subcategory: 'cvp_geral', unit: 'ocorrencias' },
  { key: 'cvp_total', category: 'robbery', subcategory: 'cvp_geral', unit: 'ocorrencias' },
  { key: 'crimes violentos contra o patrimonio', category: 'robbery', subcategory: 'cvp_geral', unit: 'ocorrencias' },
  { key: 'roubo a pessoa', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo_pessoa', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo a transeunte', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo_transeunte', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'cvp transeunte', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'cvp_transeunte', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo a coletivo', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'roubo em transporte coletivo', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'roubo_onibus', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'cvp coletivo', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'cvp_coletivo', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'roubo a comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo em comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo_comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'cvp comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'cvp_comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo a residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'roubo em residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'roubo_residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'cvp residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'cvp_residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'roubo', category: 'robbery', subcategory: 'roubo_geral', unit: 'ocorrencias' },
  { key: 'roubo_geral', category: 'robbery', subcategory: 'roubo_geral', unit: 'ocorrencias' },
  { key: 'extorsao', category: 'robbery', subcategory: 'extorsao', unit: 'ocorrencias' },

  // Furtos diversos
  { key: 'furto', category: 'theft', subcategory: 'furto_geral', unit: 'ocorrencias' },
  { key: 'furto_geral', category: 'theft', subcategory: 'furto_geral', unit: 'ocorrencias' },
  { key: 'furtos diversos', category: 'theft', subcategory: 'furto_geral', unit: 'ocorrencias' },
  { key: 'furto qualificado', category: 'theft', subcategory: 'furto_qualificado', unit: 'ocorrencias' },
  { key: 'furto simples', category: 'theft', subcategory: 'furto_simples', unit: 'ocorrencias' },

  // Drogas e entorpecentes
  { key: 'trafico de drogas', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'trafico_drogas', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'trafico de entorpecentes', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'apreensao de drogas', category: 'drug_related', subcategory: 'apreensao_drogas', unit: 'ocorrencias' },
  { key: 'apreensao_drogas', category: 'drug_related', subcategory: 'apreensao_drogas', unit: 'ocorrencias' },
  { key: 'entorpecentes', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },

  // Armas e outros
  { key: 'apreensao de armas', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'apreensao_armas', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'armas apreendidas', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'armas de fogo', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'estelionato', category: 'other', subcategory: 'estelionato', unit: 'ocorrencias' },
  { key: 'outros', category: 'other', subcategory: 'outros', unit: 'ocorrencias' }
];

const CE_MONTH_NAMES_MAP: Record<string, number> = {
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
 * Adapter oficial para SSPDS-CE (Secretaria da Segurança Pública e Defesa Social do Estado do Ceará).
 * Suporta os relatórios estatísticos municipais com métricas de CVLI e CVP consolidados pela SUPESP/GEESP.
 */
export class SspdsCeAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Secretaria da Segurança Pública e Defesa Social do Ceará - SSPDS-CE",
      agency: "SSPDS-CE",
      frequency: "Mensal",
      coverage: "CE",
      limitations: [
        "Estatísticas de CVLI (Crimes Violentos Letais Intencionais) e CVP (Crimes Violentos contra o Patrimônio) consolidadas pela SUPESP / GEESP",
        "Cobertura total de 100% dos 184 municípios do Estado do Ceará",
        "Suporta dados agregados matriciais (wide) e relatórios verticais por natureza criminal"
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
    const url = `https://www.sspds.ce.gov.br/estatisticas-2`;

    return {
      source: "SSPDS-CE",
      dataset: "indicadores_municipais_ce",
      url,
      version,
      checksum: crypto.createHash('sha256').update(`sspds-ce-${version}`).digest('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    console.log(`[SSPDS-CE Adapter] Ingestão pronta para ${destinationPath}`);
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
      ['cod_ibge', 'codigo_ibge', 'ibge', 'municipio', 'nome_municipio', 'cidade', 'ais'].includes(h)
    );
    const hasYear = cleanHeaders.some(h => ['ano', 'year'].includes(h));
    const hasMonth = cleanHeaders.some(h => ['mes', 'month', 'periodo', 'trimestre'].includes(h));

    // Formato 1: Wide (colunas de crimes, CVLI, CVP)
    const hasWideCols = cleanHeaders.some(h => 
      ['cvli', 'homicidio_doloso', 'homicidio doloso', 'cvp', 'cvp_total', 'cvp_veiculo', 'roubo_veiculo', 'roubo de veiculo', 'furto_veiculo', 'furto de veiculo', 'furto', 'estupro', 'trafico_drogas'].includes(h)
    );

    if (hasLocation && hasYear && hasMonth && hasWideCols) {
      return {
        valid: true,
        format: 'indicators',
        detectedColumns: cleanHeaders
      };
    }

    // Formato 2: Vertical (coluna de natureza/crime)
    const hasNatureza = cleanHeaders.some(h => ['natureza', 'crime', 'delito', 'indicador', 'fato', 'tipo_crime'].includes(h));
    const hasValueCol = cleanHeaders.some(h => ['total', 'quantidade', 'ocorrencias', 'vitimas', 'registros', 'frequencia'].includes(h));

    if (hasLocation && hasYear && hasMonth && hasNatureza && hasValueCol) {
      return {
        valid: true,
        format: 'indicators',
        detectedColumns: cleanHeaders
      };
    }

    const missing: string[] = [];
    if (!hasLocation) missing.push('cod_ibge / municipio / ais');
    if (!hasYear) missing.push('ano');
    if (!hasMonth) missing.push('mes / periodo');
    if (!hasWideCols && !hasNatureza) missing.push('colunas de crimes/CVLI/CVP ou natureza/indicador');

    return {
      valid: false,
      error: `Schema incompatível para SSPDS-CE. Colunas ausentes: ${missing.join(', ')}`,
      missingColumns: missing
    };
  }

  /**
   * Mapeamento de texto penal para categoria canônica nacional.
   */
  mapCrimeToCanonical(naturezaStr: string): CanonicalCategory {
    const clean = (naturezaStr || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // 1. Busca correspondência exata primeiro
    const exact = CE_CRIME_DEFINITIONS.find(m => m.key === clean);
    if (exact) return exact.category;

    // 2. Tentativas (não letais)
    if (clean.includes('tentativa') || clean.includes('tentado')) {
      if (clean.includes('estupro') || clean.includes('sexual')) return 'sexual_crime';
      return 'bodily_harm';
    }

    // 3. Busca por termos mais específicos
    const found = CE_CRIME_DEFINITIONS.find(m => clean.includes(m.key));
    if (found) return found.category;

    if (clean.includes('cvli') || clean.includes('homicidio') || clean.includes('morte') || clean.includes('latrocinio') || clean.includes('feminicidio')) return 'homicide';
    if (clean.includes('veiculo') && (clean.includes('roubo') || clean.includes('cvp'))) return 'vehicle_robbery';
    if (clean.includes('veiculo') && clean.includes('furto')) return 'vehicle_theft';
    if (clean.includes('carga')) return 'cargo_theft';
    if (clean.includes('estupro') || clean.includes('sexual')) return 'sexual_crime';
    if (clean.includes('lesao') || clean.includes('agressao')) return 'bodily_harm';
    if (clean.includes('droga') || clean.includes('entorpecente') || clean.includes('toxico')) return 'drug_related';
    if (clean.includes('cvp') || clean.includes('roubo') || clean.includes('transeunte') || clean.includes('assalto') || clean.includes('coletivo') || clean.includes('pessoa')) return 'robbery';
    if (clean.includes('furto')) return 'theft';

    return 'other';
  }

  /**
   * Helper para extrair valor numérico seguro de uma coluna.
   */
  private extractNumericValue(row: Record<string, any>, key: string): number {
    const val = row[key];
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).trim().replace(/\./g, '').replace(',', '.');
    if (cleanStr === '-' || cleanStr.toUpperCase() === 'N/D' || cleanStr.toUpperCase() === 'ND') return 0;
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
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
    const rawMes = normalizedRow['mes'] || normalizedRow['month'] || normalizedRow['periodo'] || normalizedRow['trimestre'];
    if (!rawAno || !rawMes) return null;

    const ano = parseInt(String(rawAno).replace(/\D/g, ''), 10);
    let mesNum = 0;
    const cleanMesStr = String(rawMes).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (CE_MONTH_NAMES_MAP[cleanMesStr]) {
      mesNum = CE_MONTH_NAMES_MAP[cleanMesStr];
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
    const rawNatureza = normalizedRow['natureza'] || normalizedRow['crime'] || normalizedRow['delito'] || normalizedRow['indicador'] || normalizedRow['fato'] || normalizedRow['tipo_crime'];
    if (rawNatureza) {
      const naturezaStr = String(rawNatureza).trim();
      const canonicalCategory = this.mapCrimeToCanonical(naturezaStr);

      const cleanNaturezaKey = naturezaStr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const def = CE_CRIME_DEFINITIONS.find(d => d.key === cleanNaturezaKey || cleanNaturezaKey.includes(d.key));
      const subcategory = def?.subcategory || cleanNaturezaKey.replace(/\s+/g, '_');
      const unit = def?.unit || (canonicalCategory === 'homicide' ? 'vitimas' : 'ocorrencias');

      const rawVal = normalizedRow['total'] ?? normalizedRow['quantidade'] ?? normalizedRow['ocorrencias'] ?? normalizedRow['vitimas'] ?? normalizedRow['registros'] ?? normalizedRow['frequencia'];
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
            sourceId: 'SSPDS-CE',
            datasetId: 'indicadores_municipais_ce',
            stateCode: 'CE',
            stateName: 'Ceará',
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

    // CASO 2: Formato Matricial / Wide
    // 1. Homicide (CVLI ou soma consolidada de homicídio, latrocínio, feminicídio e lesão seguida de morte)
    const cvliVal = this.extractNumericValue(normalizedRow, 'cvli') || this.extractNumericValue(normalizedRow, 'crimes_violentos_letais_intencionais');
    const homVal = this.extractNumericValue(normalizedRow, 'homicidio_doloso') || this.extractNumericValue(normalizedRow, 'homicidio');
    const latroVal = this.extractNumericValue(normalizedRow, 'latrocinio') || this.extractNumericValue(normalizedRow, 'roubo_seguido_de_morte');
    const femVal = this.extractNumericValue(normalizedRow, 'feminicidio');
    const lesaoMorteVal = this.extractNumericValue(normalizedRow, 'lesao_morte') || this.extractNumericValue(normalizedRow, 'lesao_corporal_seguida_de_morte');

    const totalHomicide = cvliVal > 0 ? cvliVal : (homVal + latroVal + femVal + lesaoMorteVal);
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSPDS-CE',
        datasetId: 'indicadores_municipais_ce',
        stateCode: 'CE',
        stateName: 'Ceará',
        municipalityCode: municipalityCode,
        municipalityName: municipalityName,
        category: 'homicide',
        subcategory: cvliVal > 0 ? 'cvli' : 'homicidio_doloso',
        sourceCategory: cvliVal > 0 ? 'cvli' : 'homicidio_doloso',
        period: periodStr,
        value: totalHomicide,
        unit: 'vitimas',
        granularity: 'municipality',
        sourceData: null
      }
    });

    // 2. Vehicle Robbery (CVP Veículo / Roubo de Veículo)
    const vehRob = this.extractNumericValue(normalizedRow, 'roubo_veiculo') || this.extractNumericValue(normalizedRow, 'roubo_de_veiculo') || this.extractNumericValue(normalizedRow, 'cvp_veiculo') || this.extractNumericValue(normalizedRow, 'roubo_auto') || this.extractNumericValue(normalizedRow, 'roubo_de_veiculos');
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSPDS-CE',
        datasetId: 'indicadores_municipais_ce',
        stateCode: 'CE',
        stateName: 'Ceará',
        municipalityCode: municipalityCode,
        municipalityName: municipalityName,
        category: 'vehicle_robbery',
        subcategory: 'roubo_veiculo',
        sourceCategory: 'roubo_veiculo',
        period: periodStr,
        value: vehRob,
        unit: 'ocorrencias',
        granularity: 'municipality',
        sourceData: null
      }
    });

    // 3. Vehicle Theft (Furto de Veículo)
    const vehTheft = this.extractNumericValue(normalizedRow, 'furto_veiculo') || this.extractNumericValue(normalizedRow, 'furto_de_veiculo') || this.extractNumericValue(normalizedRow, 'furto_auto') || this.extractNumericValue(normalizedRow, 'furto_de_veiculos');
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSPDS-CE',
        datasetId: 'indicadores_municipais_ce',
        stateCode: 'CE',
        stateName: 'Ceará',
        municipalityCode: municipalityCode,
        municipalityName: municipalityName,
        category: 'vehicle_theft',
        subcategory: 'furto_veiculo',
        sourceCategory: 'furto_veiculo',
        period: periodStr,
        value: vehTheft,
        unit: 'ocorrencias',
        granularity: 'municipality',
        sourceData: null
      }
    });

    // 4. Robbery / CVP (Transeunte / Coletivo / Comércio / Residência / CVP Total)
    const cvpTot = this.extractNumericValue(normalizedRow, 'cvp') || this.extractNumericValue(normalizedRow, 'cvp_total') || this.extractNumericValue(normalizedRow, 'crimes_violentos_contra_o_patrimonio');
    const robBus = this.extractNumericValue(normalizedRow, 'cvp_coletivo') || this.extractNumericValue(normalizedRow, 'roubo_onibus') || this.extractNumericValue(normalizedRow, 'roubo_coletivo');
    const robCom = this.extractNumericValue(normalizedRow, 'cvp_comercio') || this.extractNumericValue(normalizedRow, 'roubo_comercio');
    const robRes = this.extractNumericValue(normalizedRow, 'cvp_residencia') || this.extractNumericValue(normalizedRow, 'roubo_residencia');
    const robTran = this.extractNumericValue(normalizedRow, 'cvp_transeunte') || this.extractNumericValue(normalizedRow, 'roubo_transeunte') || this.extractNumericValue(normalizedRow, 'roubo_pessoa') || this.extractNumericValue(normalizedRow, 'roubo_a_pessoa');
    const robGer = this.extractNumericValue(normalizedRow, 'roubo') || this.extractNumericValue(normalizedRow, 'roubo_geral');
    
    const aggregatedSub = (robBus + robCom + robRes + robTran);
    const totalRobbery = cvpTot > 0 ? cvpTot : (aggregatedSub > 0 ? aggregatedSub : robGer);

    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSPDS-CE',
        datasetId: 'indicadores_municipais_ce',
        stateCode: 'CE',
        stateName: 'Ceará',
        municipalityCode: municipalityCode,
        municipalityName: municipalityName,
        category: 'robbery',
        subcategory: 'cvp_geral',
        sourceCategory: 'cvp',
        period: periodStr,
        value: totalRobbery,
        unit: 'ocorrencias',
        granularity: 'municipality',
        sourceData: null
      }
    });

    // 5. Theft (Furto Geral)
    const theftVal = this.extractNumericValue(normalizedRow, 'furto') || this.extractNumericValue(normalizedRow, 'furto_geral') || this.extractNumericValue(normalizedRow, 'furtos_diversos') || this.extractNumericValue(normalizedRow, 'furto_qualificado');
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSPDS-CE',
        datasetId: 'indicadores_municipais_ce',
        stateCode: 'CE',
        stateName: 'Ceará',
        municipalityCode: municipalityCode,
        municipalityName: municipalityName,
        category: 'theft',
        subcategory: 'furto_geral',
        sourceCategory: 'furto',
        period: periodStr,
        value: theftVal,
        unit: 'ocorrencias',
        granularity: 'municipality',
        sourceData: null
      }
    });

    // 6. Sexual Crime (Estupro)
    const rapeVal = this.extractNumericValue(normalizedRow, 'estupro') || this.extractNumericValue(normalizedRow, 'estupro_vulneravel');
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSPDS-CE',
        datasetId: 'indicadores_municipais_ce',
        stateCode: 'CE',
        stateName: 'Ceará',
        municipalityCode: municipalityCode,
        municipalityName: municipalityName,
        category: 'sexual_crime',
        subcategory: 'estupro',
        sourceCategory: 'estupro',
        period: periodStr,
        value: rapeVal,
        unit: 'vitimas',
        granularity: 'municipality',
        sourceData: null
      }
    });

    // 7. Drug Related (Tráfico de Drogas)
    const drugVal = this.extractNumericValue(normalizedRow, 'trafico_drogas') || this.extractNumericValue(normalizedRow, 'trafico_de_drogas') || this.extractNumericValue(normalizedRow, 'entorpecentes') || this.extractNumericValue(normalizedRow, 'apreensao_drogas');
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSPDS-CE',
        datasetId: 'indicadores_municipais_ce',
        stateCode: 'CE',
        stateName: 'Ceará',
        municipalityCode: municipalityCode,
        municipalityName: municipalityName,
        category: 'drug_related',
        subcategory: 'trafico_drogas',
        sourceCategory: 'trafico_drogas',
        period: periodStr,
        value: drugVal,
        unit: 'ocorrencias',
        granularity: 'municipality',
        sourceData: null
      }
    });

    // 8. Other / Apreensão de Armas
    const armsVal = this.extractNumericValue(normalizedRow, 'apreensao_armas') || this.extractNumericValue(normalizedRow, 'apreensao_de_armas') || this.extractNumericValue(normalizedRow, 'armas_fogo') || this.extractNumericValue(normalizedRow, 'armas_apreendidas');
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSPDS-CE',
        datasetId: 'indicadores_municipais_ce',
        stateCode: 'CE',
        stateName: 'Ceará',
        municipalityCode: municipalityCode,
        municipalityName: municipalityName,
        category: 'other',
        subcategory: 'armas_apreendidas',
        sourceCategory: 'apreensao_armas',
        period: periodStr,
        value: armsVal,
        unit: 'armas',
        granularity: 'municipality',
        sourceData: null
      }
    });

    return records.length > 0 ? records : null;
  }
}
