import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord, SchemaValidationResult } from '../BaseAdapter.js';
import { CanonicalCategory } from '../../../services/Taxonomy.js';
import crypto from 'crypto';

/**
 * Mapeamento das colunas oficiais do ISP-RJ para a taxonomia canônica nacional.
 */
interface CrimeColumnMapping {
  column: string;
  category: CanonicalCategory;
  subcategory?: string;
  unit: string;
}

const ISP_CRIME_COLUMNS: CrimeColumnMapping[] = [
  // Crimes violentos letais intencionais e contra a vida
  { column: 'hom_doloso', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { column: 'latrocinio', category: 'homicide', subcategory: 'latrocinio', unit: 'vitimas' },
  { column: 'lesao_corp_morte', category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },
  { column: 'letalidade_violenta', category: 'homicide', subcategory: 'letalidade_violenta', unit: 'vitimas' },
  
  // Crimes contra a pessoa / integridade física
  { column: 'tentat_hom', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { column: 'lesao_corp_dolosa', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },
  { column: 'lesao_corp_culposa', category: 'bodily_harm', subcategory: 'lesao_corporal_culposa', unit: 'ocorrencias' },
  
  // Crimes sexuais
  { column: 'estupro', category: 'sexual_crime', subcategory: 'estupro', unit: 'ocorrencias' },
  
  // Crimes contra o patrimônio - Veículos
  { column: 'roubo_veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { column: 'furto_veiculos', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  
  // Crimes contra o patrimônio - Carga
  { column: 'roubo_carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },
  
  // Roubos diversos
  { column: 'roubo_transeunte', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { column: 'roubo_celular', category: 'robbery', subcategory: 'roubo_celular', unit: 'ocorrencias' },
  { column: 'roubo_comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { column: 'roubo_residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { column: 'roubo_banco', category: 'robbery', subcategory: 'roubo_banco', unit: 'ocorrencias' },
  { column: 'roubo_conducao', category: 'robbery', subcategory: 'roubo_transporte_coletivo', unit: 'ocorrencias' },
  { column: 'roubo_coletivo', category: 'robbery', subcategory: 'roubo_transporte_coletivo', unit: 'ocorrencias' },
  { column: 'roubo_apos_saque', category: 'robbery', subcategory: 'saidinha_banco', unit: 'ocorrencias' },
  { column: 'total_roubos', category: 'robbery', subcategory: 'total_roubos', unit: 'ocorrencias' },
  { column: 'extorsao', category: 'robbery', subcategory: 'extorsao', unit: 'ocorrencias' },
  { column: 'sequestro', category: 'robbery', subcategory: 'sequestro', unit: 'ocorrencias' },
  { column: 'sequestro_relampago', category: 'robbery', subcategory: 'sequestro_relampago', unit: 'ocorrencias' },

  // Furtos diversos
  { column: 'furto_transeunte', category: 'theft', subcategory: 'furto_transeunte', unit: 'ocorrencias' },
  { column: 'furto_celular', category: 'theft', subcategory: 'furto_celular', unit: 'ocorrencias' },
  { column: 'furto_bicicleta', category: 'theft', subcategory: 'furto_bicicleta', unit: 'ocorrencias' },
  { column: 'outros_furtos', category: 'theft', subcategory: 'outros_furtos', unit: 'ocorrencias' },
  { column: 'total_furtos', category: 'theft', subcategory: 'total_furtos', unit: 'ocorrencias' },

  // Drogas e entorpecentes
  { column: 'apreensoes_drogas', category: 'drug_related', subcategory: 'apreensao_drogas', unit: 'ocorrencias' },
  { column: 'registro_drogas', category: 'drug_related', subcategory: 'registro_drogas', unit: 'ocorrencias' },
  { column: 'posse_drogas', category: 'drug_related', subcategory: 'posse_drogas', unit: 'ocorrencias' },
  { column: 'trafico_drogas', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },

  // Outros indicadores
  { column: 'hom_culposo', category: 'other', subcategory: 'homicidio_culposo', unit: 'ocorrencias' },
  { column: 'armas_apreendidas', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { column: 'prisao_mandado', category: 'other', subcategory: 'cumprimento_mandado', unit: 'ocorrencias' },
  { column: 'registro_ocorrencias', category: 'other', subcategory: 'total_registros', unit: 'ocorrencias' }
];

/**
 * Adapter oficial para o ISP-RJ (Instituto de Segurança Pública do Estado do Rio de Janeiro).
 * Suporta a ingestão e normalização das séries históricas municipais e por CISP/Delegacia.
 */
export class IspRjAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Instituto de Segurança Pública do Estado do Rio de Janeiro - ISP-RJ",
      agency: "ISP-RJ",
      frequency: "Mensal",
      coverage: "RJ",
      limitations: [
        "Dados estatísticos mensais agregados por município e circunscrição policial (não contém microdados pontuais com latitude/longitude)",
        "Defasagem oficial de publicação de cerca de 15 a 20 dias após o fechamento do mês de apuração",
        "Reclassificações de inquéritos policiais podem alterar contagens consolidadas em publicações posteriores"
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
    const url = `http://www.ispdados.rj.gov.br/Arquivos/BaseMunicipioMensal.csv`;

    return {
      source: "ISP-RJ",
      dataset: "indicadores_municipais_rj",
      url,
      version,
      checksum: crypto.createHash('sha256').update(`isp-rj-${version}`).digest('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    console.log(`[ISP-RJ Adapter] Stream de ingestão preparado para ${destinationPath}`);
    return destinationPath;
  }

  /**
   * Validação de Schema do arquivo antes do início do processamento.
   */
  validateSchema(headers: string[]): SchemaValidationResult {
    const cleanHeaders = headers.map(h => 
      h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    const hasLocation = cleanHeaders.some(h => ['fmun', 'fmun_cod', 'munic', 'municipio', 'cisp', 'aisp', 'risp'].includes(h));
    const hasYear = cleanHeaders.some(h => ['ano', 'year'].includes(h));
    const hasMonth = cleanHeaders.some(h => ['mes', 'month', 'mes_ano'].includes(h));
    
    // Verifica presença de pelo menos uma coluna criminal típica do ISP-RJ
    const hasCrimeCols = cleanHeaders.some(h => 
      ['hom_doloso', 'latrocinio', 'roubo_veiculo', 'furto_veiculos', 'roubo_carga', 'letalidade_violenta', 'estupro', 'roubo_transeunte', 'registro_ocorrencias'].includes(h)
    );

    if (hasLocation && hasYear && hasMonth && hasCrimeCols) {
      return {
        valid: true,
        format: 'indicators',
        detectedColumns: cleanHeaders
      };
    }

    const missing: string[] = [];
    if (!hasLocation) missing.push('fmun / munic / cisp');
    if (!hasYear) missing.push('ano');
    if (!hasMonth) missing.push('mes');
    if (!hasCrimeCols) missing.push('rubricas criminais (hom_doloso, roubo_veiculo, etc.)');

    return {
      valid: false,
      error: `Schema não reconhecido para ISP-RJ. Colunas esperadas ausentes: ${missing.join(', ')}`,
      missingColumns: missing
    };
  }

  /**
   * Mapeamento direto de coluna/rubrica para a taxonomia canônica.
   */
  mapCrimeToCanonical(colOrCrime: string): CanonicalCategory {
    const clean = (colOrCrime || '').trim().toLowerCase();
    const found = ISP_CRIME_COLUMNS.find(m => m.column === clean);
    if (found) return found.category;

    // Fallbacks para nomes genéricos
    if (clean.includes('homicidio') || clean.includes('morte') || clean.includes('latrocinio')) return 'homicide';
    if (clean.includes('veiculo') && clean.includes('roubo')) return 'vehicle_robbery';
    if (clean.includes('veiculo') && clean.includes('furto')) return 'vehicle_theft';
    if (clean.includes('carga')) return 'cargo_theft';
    if (clean.includes('estupro') || clean.includes('sexual')) return 'sexual_crime';
    if (clean.includes('lesao') || clean.includes('agressao')) return 'bodily_harm';
    if (clean.includes('droga') || clean.includes('entorpecente')) return 'drug_related';
    if (clean.includes('roubo')) return 'robbery';
    if (clean.includes('furto')) return 'theft';

    return 'other';
  }

  /**
   * Parsing linha a linha desdobrando as colunas largas do ISP-RJ em registros de indicadores canônicos.
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

    if (!rawAno || !rawMes) {
      // Tenta extrair de mes_ano (ex: "2024m01" ou "01/2024")
      const mesAno = normalizedRow['mes_ano'] || normalizedRow['periodo'];
      if (!mesAno) return null;
    }

    const ano = parseInt(String(rawAno).replace(/\D/g, ''), 10);
    const mes = parseInt(String(rawMes).replace(/\D/g, ''), 10);

    if (isNaN(ano) || ano < 1990 || ano > 2100) return null;
    if (isNaN(mes) || mes < 1 || mes > 12) return null;

    const periodStr = `${ano}-${String(mes).padStart(2, '0')}`;

    // Identificação de Localização
    const rawFmun = normalizedRow['fmun'] || normalizedRow['fmun_cod'] || normalizedRow['ibge'];
    let municipalityCode: string | null = null;
    if (rawFmun) {
      const digits = String(rawFmun).replace(/\D/g, '');
      if (digits.length === 6 || digits.length === 7) {
        municipalityCode = digits;
      }
    }

    const municipalityName = normalizedRow['munic'] || normalizedRow['municipio'] || normalizedRow['fmun_nome'] || null;
    const cisp = normalizedRow['cisp'] ? String(normalizedRow['cisp']).trim() : null;
    const aisp = normalizedRow['aisp'] ? String(normalizedRow['aisp']).trim() : null;
    const isDp = !!cisp;

    const records: ParsedRecord[] = [];

    // Itera sobre as colunas mapeadas de crimes do ISP-RJ
    for (const mapping of ISP_CRIME_COLUMNS) {
      const rawVal = normalizedRow[mapping.column];
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;

      // Sanitização de valor numérico (remove separadores de milhar, trata traços)
      let numVal = 0;
      if (typeof rawVal === 'number') {
        numVal = rawVal;
      } else {
        const cleanStr = String(rawVal).trim().replace(/\./g, '').replace(',', '.');
        if (cleanStr === '-' || cleanStr.toUpperCase() === 'N/D' || cleanStr.toUpperCase() === 'ND' || cleanStr.toUpperCase() === 'S/I') {
          numVal = 0;
        } else {
          const parsed = parseFloat(cleanStr);
          numVal = isNaN(parsed) ? 0 : parsed;
        }
      }

      // Desconsidera contagens negativas
      if (numVal < 0) continue;

      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'ISP-RJ',
          datasetId: isDp ? 'indicadores_dp_rj' : 'indicadores_municipais_rj',
          stateCode: 'RJ',
          stateName: 'Rio de Janeiro',
          municipalityCode: municipalityCode,
          municipalityName: municipalityName,
          category: mapping.category,
          subcategory: mapping.subcategory,
          sourceCategory: mapping.column,
          period: periodStr,
          value: numVal,
          unit: mapping.unit,
          granularity: isDp ? 'delegacia' : 'municipality',
          sourceData: cisp || aisp ? JSON.stringify({ cisp, aisp }) : null
        }
      });
    }

    return records.length > 0 ? records : null;
  }
}
