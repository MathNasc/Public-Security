import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord, SchemaValidationResult } from '../BaseAdapter.js';
import { CanonicalCategory } from '../../../services/Taxonomy.js';
import crypto from 'crypto';

interface PaCrimeMapping {
  key: string;
  category: CanonicalCategory;
  subcategory?: string;
  unit: string;
}

const PA_CRIME_DEFINITIONS: PaCrimeMapping[] = [
  // Crimes Violentos Letais Intencionais (CVLI) - Mortes Violentas
  { key: 'homicidio doloso', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'homicidio_doloso', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'homicidio', category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  { key: 'cvli', category: 'homicide', subcategory: 'cvli', unit: 'vitimas' },
  { key: 'crimes violentos letais intencionais', category: 'homicide', subcategory: 'cvli', unit: 'vitimas' },
  { key: 'latrocinio', category: 'homicide', subcategory: 'latrocinio', unit: 'vitimas' },
  { key: 'roubo seguido de morte', category: 'homicide', subcategory: 'latrocinio', unit: 'vitimas' },
  { key: 'feminicidio', category: 'homicide', subcategory: 'feminicidio', unit: 'vitimas' },
  { key: 'lesao corporal seguida de morte', category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },
  { key: 'lesao_morte', category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },
  { key: 'morte por intervencao de agente do estado', category: 'homicide', subcategory: 'intervencao_policial', unit: 'vitimas' },
  { key: 'intervencao policial', category: 'homicide', subcategory: 'intervencao_policial', unit: 'vitimas' },

  // Integridade Física / Tentativas
  { key: 'tentativa de homicidio', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'tentativa_homicidio', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'homicidio tentado', category: 'bodily_harm', subcategory: 'tentativa_homicidio', unit: 'ocorrencias' },
  { key: 'lesao corporal dolosa', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },
  { key: 'lesao corporal', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },
  { key: 'lesao_corporal', category: 'bodily_harm', subcategory: 'lesao_corporal_dolosa', unit: 'ocorrencias' },
  { key: 'violencia domestica', category: 'bodily_harm', subcategory: 'violencia_domestica', unit: 'ocorrencias' },
  { key: 'violencia domestica contra a mulher', category: 'bodily_harm', subcategory: 'violencia_domestica', unit: 'ocorrencias' },

  // Dignidade Sexual
  { key: 'estupro', category: 'sexual_crime', subcategory: 'estupro', unit: 'vitimas' },
  { key: 'estupro de vulneravel', category: 'sexual_crime', subcategory: 'estupro_vulneravel', unit: 'vitimas' },
  { key: 'estupro_vulneravel', category: 'sexual_crime', subcategory: 'estupro_vulneravel', unit: 'vitimas' },
  { key: 'tentativa de estupro', category: 'sexual_crime', subcategory: 'tentativa_estupro', unit: 'ocorrencias' },
  { key: 'crimes contra os costumes', category: 'sexual_crime', subcategory: 'estupro', unit: 'vitimas' },

  // Crimes contra o Patrimônio - Veículos
  { key: 'roubo de veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo_veiculo', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo de veiculos', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo de automoveis', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo de auto', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo de motocicletas', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'roubo de moto', category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  { key: 'furto de veiculo', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto_veiculo', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto de veiculos', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto de auto', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  { key: 'furto de moto', category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },

  // Crimes contra o Patrimônio - Carga
  { key: 'roubo de carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },
  { key: 'roubo_carga', category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },
  { key: 'furto de carga', category: 'cargo_theft', subcategory: 'furto_carga', unit: 'ocorrencias' },

  // Crimes contra o Patrimônio - Roubos (CVP) e Pirataria Fluvial
  { key: 'roubo a transeunte', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo_transeunte', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo a pessoa', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo_pessoa', category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  { key: 'roubo em comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo a comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo_comercio', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo em estabelecimento comercial', category: 'robbery', subcategory: 'roubo_comercio', unit: 'ocorrencias' },
  { key: 'roubo em residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'roubo a residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'roubo_residencia', category: 'robbery', subcategory: 'roubo_residencia', unit: 'ocorrencias' },
  { key: 'roubo em transporte coletivo', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'roubo a coletivo', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'roubo_coletivo', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'roubo a onibus', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'roubo_onibus', category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  { key: 'pirataria fluvial', category: 'robbery', subcategory: 'roubo_embarcacao', unit: 'ocorrencias' },
  { key: 'roubo em embarcacoes', category: 'robbery', subcategory: 'roubo_embarcacao', unit: 'ocorrencias' },
  { key: 'roubo fluvial', category: 'robbery', subcategory: 'roubo_embarcacao', unit: 'ocorrencias' },
  { key: 'roubo', category: 'robbery', subcategory: 'roubo_geral', unit: 'ocorrencias' },
  { key: 'roubo_geral', category: 'robbery', subcategory: 'roubo_geral', unit: 'ocorrencias' },
  { key: 'crimes violentos contra o patrimonio', category: 'robbery', subcategory: 'cvp_geral', unit: 'ocorrencias' },
  { key: 'cvp', category: 'robbery', subcategory: 'cvp_geral', unit: 'ocorrencias' },
  { key: 'extorsao', category: 'robbery', subcategory: 'extorsao', unit: 'ocorrencias' },
  { key: 'extorsao mediante sequestro', category: 'robbery', subcategory: 'extorsao_sequestro', unit: 'ocorrencias' },

  // Furtos diversos
  { key: 'furto', category: 'theft', subcategory: 'furto_geral', unit: 'ocorrencias' },
  { key: 'furto_geral', category: 'theft', subcategory: 'furto_geral', unit: 'ocorrencias' },
  { key: 'furtos diversos', category: 'theft', subcategory: 'furto_geral', unit: 'ocorrencias' },
  { key: 'furto a transeunte', category: 'theft', subcategory: 'furto_transeunte', unit: 'ocorrencias' },
  { key: 'furto em comercio', category: 'theft', subcategory: 'furto_comercio', unit: 'ocorrencias' },
  { key: 'furto em residencia', category: 'theft', subcategory: 'furto_residencia', unit: 'ocorrencias' },
  { key: 'furto qualificado', category: 'theft', subcategory: 'furto_qualificado', unit: 'ocorrencias' },

  // Drogas e entorpecentes
  { key: 'trafico de drogas', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'trafico_drogas', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'trafico de entorpecentes', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  { key: 'apreensao de drogas', category: 'drug_related', subcategory: 'apreensao_drogas', unit: 'ocorrencias' },
  { key: 'apreensao_drogas', category: 'drug_related', subcategory: 'apreensao_drogas', unit: 'ocorrencias' },
  { key: 'entorpecentes', category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },

  // Armas e produtividade
  { key: 'apreensao de armas', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'apreensao_armas', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'armas apreendidas', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'armas de fogo', category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' },
  { key: 'apreensao de municoes', category: 'other', subcategory: 'municoes_apreendidas', unit: 'municoes' },
  { key: 'mandados cumpridos', category: 'other', subcategory: 'mandados', unit: 'mandados' },
  { key: 'estelionato', category: 'other', subcategory: 'estelionato', unit: 'ocorrencias' },
  { key: 'outros', category: 'other', subcategory: 'outros', unit: 'ocorrencias' }
];

const PA_MONTH_NAMES_MAP: Record<string, number> = {
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

export class SegupPaAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Secretaria de Estado de Segurança Pública e Defesa Social do Pará (SEGUP-PA)",
      agency: "SEGUP-PA",
      frequency: "Mensal",
      coverage: "PA",
      limitations: [
        "Estatísticas consolidadas pela Diretoria de Estatística e Análise Criminal (DEAC / SIEDS)",
        "Abrangência dos 144 municípios paraenses e 10 Regiões Integradas de Segurança Pública (RISPs)"
      ]
    };
  }

  identifyVersion(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async discover(): Promise<DiscoveryResult> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return {
      source: "SEGUP-PA",
      dataset: "indicadores_municipais_pa",
      url: `https://www.segup.pa.gov.br/estatisticas/dados_${year}_${month}.csv`,
      version: `${year}-${month}`,
      checksum: crypto.createHash('sha256').update(`SEGUP-PA-${year}-${month}`).digest('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    return destinationPath;
  }

  validateSchema(headers: string[]): SchemaValidationResult {
    const normalizedHeaders = headers.map(h => 
      h.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
    );

    const hasGeo = normalizedHeaders.some(h => 
      h.includes('municipio') || h.includes('cidade') || h.includes('cod_ibge') || h.includes('ibge') || h.includes('risp') || h.includes('cprp')
    );

    const hasTime = normalizedHeaders.some(h => 
      h.includes('ano') || h.includes('mes') || h.includes('periodo') || h.includes('data')
    );

    const hasWideCrimes = normalizedHeaders.some(h => 
      h.includes('homicidio') || h.includes('cvli') || h.includes('latrocinio') || 
      h.includes('roubo') || h.includes('furto') || h.includes('estupro') || 
      h.includes('drogas') || h.includes('armas')
    );

    const hasVerticalCols = normalizedHeaders.some(h => 
      h.includes('natureza') || h.includes('crime') || h.includes('delito') || h.includes('indicador')
    ) && normalizedHeaders.some(h => 
      h.includes('total') || h.includes('quantidade') || h.includes('ocorrencias') || h.includes('vitimas') || h.includes('valor')
    );

    if (hasGeo && hasTime && (hasWideCrimes || hasVerticalCols)) {
      return { valid: true, format: 'indicators' };
    }

    const missing: string[] = [];
    if (!hasGeo) missing.push('cod_ibge / municipio / risp');
    if (!hasTime) missing.push('ano, mes / periodo');
    if (!hasWideCrimes && !hasVerticalCols) missing.push('colunas de crimes ou natureza/indicador');

    return {
      valid: false,
      error: `Schema incompatível para SEGUP-PA. Colunas ausentes: ${missing.join(', ')}`,
      missingColumns: missing
    };
  }

  mapCrimeToCanonical(rawCrime: string): CanonicalCategory {
    if (!rawCrime) return 'other';
    const norm = rawCrime.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 1. Verificação exata
    for (const def of PA_CRIME_DEFINITIONS) {
      if (norm === def.key) {
        return def.category;
      }
    }

    // 2. Verificação de subcadeias prioritárias (tentativas e específicos primeiro)
    if (norm.includes('tentativa de homicidio') || norm.includes('homicidio tentado')) {
      return 'bodily_harm';
    }
    if (norm.includes('tentativa de estupro')) {
      return 'sexual_crime';
    }

    // 3. Verificação de definições ordenadas por especificidade (maior comprimento da chave)
    const sortedDefs = [...PA_CRIME_DEFINITIONS].sort((a, b) => b.key.length - a.key.length);
    for (const def of sortedDefs) {
      if (norm.includes(def.key)) {
        return def.category;
      }
    }

    if (norm.includes('homicid') || norm.includes('latrocin') || norm.includes('feminicid') || norm.includes('cvli') || norm.includes('letal')) {
      return 'homicide';
    }
    if (norm.includes('roubo') && (norm.includes('veiculo') || norm.includes('auto') || norm.includes('moto'))) {
      return 'vehicle_robbery';
    }
    if (norm.includes('furto') && (norm.includes('veiculo') || norm.includes('auto') || norm.includes('moto'))) {
      return 'vehicle_theft';
    }
    if (norm.includes('carga')) {
      return 'cargo_theft';
    }
    if (norm.includes('roubo') || norm.includes('assalto') || norm.includes('cvp') || norm.includes('embarca') || norm.includes('fluvial')) {
      return 'robbery';
    }
    if (norm.includes('furto')) {
      return 'theft';
    }
    if (norm.includes('estupro') || norm.includes('sexual')) {
      return 'sexual_crime';
    }
    if (norm.includes('lesao') || norm.includes('agressao') || norm.includes('tentativa')) {
      return 'bodily_harm';
    }
    if (norm.includes('droga') || norm.includes('toxico') || norm.includes('narcot') || norm.includes('entorpecente') || norm.includes('oxi')) {
      return 'drug_related';
    }

    return 'other';
  }

  private parseNumeric(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim();
    if (s === '' || s === '-' || s === '.' || s === 'NA' || s === 'N/A' || s === 'null') return 0;
    s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.round(n);
  }

  private parsePeriod(row: any): string | null {
    let year: number | null = null;
    let month: number | null = null;

    for (const k of Object.keys(row)) {
      const lk = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (lk === 'ano' || lk === 'nu_ano' || lk === 'exercicio') {
        const y = parseInt(String(row[k]).trim(), 10);
        if (!isNaN(y) && y >= 2000 && y <= 2050) year = y;
      }
      if (lk === 'mes' || lk === 'nu_mes' || lk === 'mes_ano' || lk === 'mes_extenso') {
        const mv = String(row[k]).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (PA_MONTH_NAMES_MAP[mv]) {
          month = PA_MONTH_NAMES_MAP[mv];
        } else {
          const m = parseInt(mv, 10);
          if (!isNaN(m) && m >= 1 && m <= 12) month = m;
        }
      }
      if (lk === 'periodo' || lk === 'referencia' || lk === 'data') {
        const val = String(row[k]).trim();
        const m1 = val.match(/^(\d{4})[-/](\d{1,2})$/);
        if (m1) {
          year = parseInt(m1[1], 10);
          month = parseInt(m1[2], 10);
        }
        const m2 = val.match(/^(\d{1,2})[-/](\d{4})$/);
        if (m2) {
          month = parseInt(m2[1], 10);
          year = parseInt(m2[2], 10);
        }
      }
    }

    if (!year) year = new Date().getFullYear();
    if (!month) month = 1;

    return `${year}-${String(month).padStart(2, '0')}`;
  }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    if (!row || typeof row !== 'object') return null;

    const normalizedRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanKey = k.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
      normalizedRow[cleanKey] = v;
    }

    const munName = normalizedRow['municipio'] || normalizedRow['cidade'] || normalizedRow['nome_municipio'] || normalizedRow['ds_municipio'] || '';
    const ibgeCode = normalizedRow['cod_ibge'] || normalizedRow['codigo_ibge'] || normalizedRow['ibge'] || normalizedRow['cod_municipio'] || '';
    const risp = normalizedRow['risp'] || normalizedRow['cprp'] || normalizedRow['regiao'] || '';

    const period = this.parsePeriod(normalizedRow);
    if (!period) return null;

    const natureCol = normalizedRow['natureza'] || normalizedRow['natureza_crime'] || normalizedRow['delito'] || normalizedRow['crime'] || normalizedRow['indicador'] || normalizedRow['tipo_crime'];
    const valueCol = normalizedRow['total'] || normalizedRow['quantidade'] || normalizedRow['ocorrencias'] || normalizedRow['vitimas'] || normalizedRow['qtd'] || normalizedRow['valor'];

    // 1. Formato Vertical (uma linha por crime)
    if (natureCol !== undefined && valueCol !== undefined) {
      const total = this.parseNumeric(valueCol);
      const rawNature = String(natureCol).trim();
      const canonicalCategory = this.mapCrimeToCanonical(rawNature);

      let subcat: string | undefined;
      let unit = 'ocorrencias';
      const normNatureLower = rawNature.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

      const def = PA_CRIME_DEFINITIONS.find(d => normNatureLower === d.key || normNatureLower.includes(d.key));
      if (def) {
        subcat = def.subcategory;
        unit = def.unit;
      } else if (canonicalCategory === 'homicide' || canonicalCategory === 'sexual_crime') {
        unit = 'vitimas';
      }

      const rec: ParsedRecord = {
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SEGUP-PA',
          stateCode: 'PA',
          municipalityCode: ibgeCode ? String(ibgeCode).trim() : null,
          municipalityName: munName ? String(munName).trim() : (risp ? String(risp).trim() : 'Pará'),
          category: canonicalCategory,
          subcategory: subcat || null,
          sourceCategory: rawNature,
          period,
          value: total,
          unit
        }
      };
      return [rec];
    }

    // 2. Formato Matricial / Wide (colunas com indicadores)
    const records: ParsedRecord[] = [];

    // Mapeamentos de colunas para canônicos no formato wide
    const wideMappings: { keys: string[]; category: CanonicalCategory; subcategory: string; unit: string; sumKeys?: boolean }[] = [
      {
        keys: ['homicidio_doloso', 'homicidio', 'vitimas_homicidio_doloso', 'latrocinio', 'feminicidio', 'lesao_morte'],
        category: 'homicide',
        subcategory: 'cvli',
        unit: 'vitimas',
        sumKeys: true
      },
      {
        keys: ['roubo_veiculo', 'roubo_veiculos', 'roubo_de_veiculo', 'roubo_auto', 'roubo_moto'],
        category: 'vehicle_robbery',
        subcategory: 'roubo_veiculo',
        unit: 'ocorrencias',
        sumKeys: true
      },
      {
        keys: ['furto_veiculo', 'furto_veiculos', 'furto_de_veiculo', 'furto_auto', 'furto_moto'],
        category: 'vehicle_theft',
        subcategory: 'furto_veiculo',
        unit: 'ocorrencias',
        sumKeys: true
      },
      {
        keys: ['roubo_carga', 'roubo_de_carga'],
        category: 'cargo_theft',
        subcategory: 'roubo_carga',
        unit: 'ocorrencias'
      },
      {
        keys: ['roubo_transeunte', 'roubo_pessoa', 'roubo_comercio', 'roubo_residencia', 'roubo_coletivo', 'roubo_onibus', 'pirataria_fluvial', 'roubo_embarcacoes', 'roubo_geral', 'roubo', 'cvp'],
        category: 'robbery',
        subcategory: 'cvp_geral',
        unit: 'ocorrencias',
        sumKeys: true
      },
      {
        keys: ['furto', 'furto_geral', 'furtos', 'furto_transeunte', 'furto_comercio', 'furto_residencia'],
        category: 'theft',
        subcategory: 'furto_geral',
        unit: 'ocorrencias',
        sumKeys: true
      },
      {
        keys: ['estupro', 'estupro_vulneravel', 'vitimas_estupro'],
        category: 'sexual_crime',
        subcategory: 'estupro',
        unit: 'vitimas',
        sumKeys: true
      },
      {
        keys: ['tentativa_homicidio', 'lesao_corporal', 'lesao_corporal_dolosa', 'violencia_domestica'],
        category: 'bodily_harm',
        subcategory: 'integridade_corporal',
        unit: 'ocorrencias',
        sumKeys: true
      },
      {
        keys: ['trafico_drogas', 'trafico_de_drogas', 'entorpecentes', 'apreensao_drogas'],
        category: 'drug_related',
        subcategory: 'trafico_drogas',
        unit: 'ocorrencias',
        sumKeys: true
      },
      {
        keys: ['apreensao_armas', 'armas_apreendidas', 'armas_de_fogo', 'apreensao_de_armas'],
        category: 'other',
        subcategory: 'armas_apreendidas',
        unit: 'armas',
        sumKeys: true
      }
    ];

    for (const mapping of wideMappings) {
      let val = 0;
      let foundKey = false;
      const matchedKeys: string[] = [];

      for (const k of mapping.keys) {
        if (normalizedRow[k] !== undefined) {
          const num = this.parseNumeric(normalizedRow[k]);
          val += num;
          foundKey = true;
          matchedKeys.push(k);
        }
      }

      if (foundKey) {
        records.push({
          target: 'indicators',
          data: {
            id: crypto.randomUUID(),
            sourceId: 'SEGUP-PA',
            stateCode: 'PA',
            municipalityCode: ibgeCode ? String(ibgeCode).trim() : null,
            municipalityName: munName ? String(munName).trim() : (risp ? String(risp).trim() : 'Pará'),
            category: mapping.category,
            subcategory: mapping.subcategory,
            sourceCategory: matchedKeys.join('+'),
            period,
            value: val,
            unit: mapping.unit
          }
        });
      }
    }

    return records.length > 0 ? records : null;
  }
}
