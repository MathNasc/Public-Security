import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord, SchemaValidationResult } from '../BaseAdapter.js';
import { GeoNormalizationService } from '../../../services/GeoNormalizationService.js';
import crypto from 'crypto';

export interface SspPiCrimeDefinition {
  key: string;
  category: string;
  label: string;
  unit?: string;
}

export const PI_CRIME_DEFINITIONS: SspPiCrimeDefinition[] = [
  // Crimes Violentos Letais Intencionais (CVLI) / Mortes Violentas
  { key: 'homicidio doloso', category: 'homicide', label: 'Homicídio Doloso' },
  { key: 'homicidio', category: 'homicide', label: 'Homicídio' },
  { key: 'feminicidio', category: 'homicide', label: 'Feminicídio' },
  { key: 'latrocinio', category: 'homicide', label: 'Latrocínio (Roubo Seguido de Morte)' },
  { key: 'roubo seguido de morte', category: 'homicide', label: 'Roubo Seguido de Morte' },
  { key: 'lesao corporal seguida de morte', category: 'homicide', label: 'Lesão Corporal Seguida de Morte' },
  { key: 'cvli', category: 'homicide', label: 'Crimes Violentos Letais Intencionais' },
  { key: 'crimes violentos letais intencionais', category: 'homicide', label: 'Crimes Violentos Letais Intencionais' },
  { key: 'morte violenta', category: 'homicide', label: 'Morte Violenta' },
  { key: 'intervencao policial', category: 'homicide', label: 'Morte Decorrente de Intervenção Policial' },
  { key: 'morte decorrente de intervencao policial', category: 'homicide', label: 'Morte Decorrente de Intervenção Policial' },
  { key: 'confronto policial', category: 'homicide', label: 'Morte Decorrente de Confronto Policial' },
  { key: 'mdip', category: 'homicide', label: 'Morte Decorrente de Intervenção Policial' },

  // Crimes Contra a Pessoa / Tentativas
  { key: 'tentativa de homicidio', category: 'bodily_harm', label: 'Tentativa de Homicídio' },
  { key: 'homicidio tentado', category: 'bodily_harm', label: 'Homicídio Tentado' },
  { key: 'lesao corporal dolosa', category: 'bodily_harm', label: 'Lesão Corporal Dolosa' },
  { key: 'lesao corporal', category: 'bodily_harm', label: 'Lesão Corporal' },
  { key: 'estupro', category: 'sexual_crime', label: 'Estupro' },
  { key: 'estupro de vulneravel', category: 'sexual_crime', label: 'Estupro de Vulnerável' },
  { key: 'crimes sexuais', category: 'sexual_crime', label: 'Crimes Sexuais' },

  // Crimes Violentos Contra o Patrimônio (CVP) / Roubos
  { key: 'roubo a transeunte', category: 'robbery', label: 'Roubo a Transeunte' },
  { key: 'roubo a pessoa', category: 'robbery', label: 'Roubo a Pessoa' },
  { key: 'roubo em via publica', category: 'robbery', label: 'Roubo em Via Pública' },
  { key: 'roubo a estabelecimento comercial', category: 'robbery', label: 'Roubo a Estabelecimento Comercial' },
  { key: 'roubo a comercio', category: 'robbery', label: 'Roubo a Comércio' },
  { key: 'roubo em comercio', category: 'robbery', label: 'Roubo em Comércio' },
  { key: 'roubo a residencia', category: 'robbery', label: 'Roubo a Residência' },
  { key: 'roubo em residencia', category: 'robbery', label: 'Roubo em Residência' },
  { key: 'roubo a coletivo', category: 'robbery', label: 'Roubo a Coletivo / Ônibus' },
  { key: 'roubo em transporte coletivo', category: 'robbery', label: 'Roubo em Transporte Coletivo' },
  { key: 'roubo em onibus', category: 'robbery', label: 'Roubo em Ônibus' },
  { key: 'roubo', category: 'robbery', label: 'Roubo Geral' },
  { key: 'cvp', category: 'robbery', label: 'Crimes Violentos Contra o Patrimônio' },
  { key: 'crimes violentos contra o patrimonio', category: 'robbery', label: 'Crimes Violentos Contra o Patrimônio' },
  { key: 'roubo de carga', category: 'cargo_theft', label: 'Roubo de Carga' },
  { key: 'roubo de veiculo', category: 'vehicle_robbery', label: 'Roubo de Veículo' },
  { key: 'roubo de veiculos', category: 'vehicle_robbery', label: 'Roubo de Veículos' },
  { key: 'furto de veiculo', category: 'vehicle_theft', label: 'Furto de Veículo' },
  { key: 'furto de veiculos', category: 'vehicle_theft', label: 'Furto de Veículos' },
  { key: 'furto', category: 'theft', label: 'Furto Geral' },
  { key: 'furto geral', category: 'theft', label: 'Furto Geral' },

  // Entorpecentes e Outros
  { key: 'trafico de drogas', category: 'drug_related', label: 'Tráfico de Drogas' },
  { key: 'trafico de entorpecentes', category: 'drug_related', label: 'Tráfico de Entorpecentes' },
  { key: 'posse ou porte de drogas', category: 'drug_related', label: 'Posse/Porte de Drogas' },
  { key: 'entorpecentes', category: 'drug_related', label: 'Entorpecentes' },
  { key: 'apreensao de armas', category: 'other', label: 'Apreensão de Armas de Fogo', unit: 'armas' },
  { key: 'apreensao de arma de fogo', category: 'other', label: 'Apreensão de Armas de Fogo', unit: 'armas' },
  { key: 'armas apreendidas', category: 'other', label: 'Armas Apreendidas', unit: 'armas' },
  { key: 'porte ilegal de arma', category: 'other', label: 'Porte Ilegal de Arma de Fogo', unit: 'armas' }
];

export class SspPiAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas da Secretaria de Segurança Pública do Piauí (SSP-PI)",
      agency: "SSP-PI",
      frequency: "Mensal",
      coverage: "PI",
      limitations: [
        "Os dados são compilados pela Gerência de Estatística e Análise Criminal (GEAC/SSP-PI).",
        "Indicadores de CVLI (Crimes Violentos Letais Intencionais) congregam Homicídio Doloso, Feminicídio, Latrocínio e Lesão Corporal Seguida de Morte."
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
    const currentYear = now.getFullYear();
    const version = this.identifyVersion();

    return {
      source: "SSP-PI",
      dataset: "indicadores_municipais_pi",
      url: `https://www.seguranca.pi.gov.br/dados/indicadores-${currentYear}.csv`,
      version,
      checksum: crypto.createHash('sha256').update(`ssp-pi-${version}`).digest('hex')
    };
  }

  async download(destinationPath: string): Promise<string> {
    return destinationPath;
  }

  validateSchema(headers: string[]): SchemaValidationResult {
    if (!headers || headers.length === 0) {
      return {
        valid: false,
        error: "Arquivo sem cabeçalho ou vazio.",
        missingColumns: ['headers']
      };
    }

    const normHeaders = headers.map(h => 
      h.toLowerCase()
       .normalize("NFD")
       .replace(/[\u0300-\u036f]/g, "")
       .replace(/[^a-z0-9_]/g, "_")
       .replace(/_+/g, "_")
       .replace(/^_|_$/g, "")
    );

    // Formato 1: Wide / Matricial Municipal
    const hasMuni = normHeaders.some(h => 
      h.includes('municipio') || h.includes('cidade') || h.includes('cod_ibge') || h.includes('ibge') || h.includes('aisp') || h.includes('delegacia')
    );
    const hasTime = normHeaders.some(h => 
      h.includes('ano') || h.includes('mes') || h.includes('periodo') || h.includes('data')
    );

    const wideCrimeCols = [
      'homicidio_doloso', 'homicidio', 'latrocinio', 'roubo_veiculo', 'furto_veiculo', 
      'roubo_transeunte', 'furto', 'estupro', 'trafico_drogas', 'cvli', 'cvp', 'lesao_corporal'
    ];
    const matchingWideCols = normHeaders.filter(h => wideCrimeCols.some(c => h.includes(c)));

    if (hasMuni && hasTime && matchingWideCols.length >= 2) {
      return { valid: true, format: 'indicators' };
    }

    // Formato 2: Vertical / Registro por Linha de Ocorrência Consolidada
    const hasNatureza = normHeaders.some(h => 
      h.includes('natureza') || h.includes('crime') || h.includes('delito') || h.includes('indicador') || h.includes('evento')
    );
    const hasQtd = normHeaders.some(h => 
      h.includes('quantidade') || h.includes('total') || h.includes('qtd') || h.includes('valor') || h.includes('ocorrencias') || h.includes('vitimas')
    );

    if (hasMuni && (hasTime || normHeaders.some(h => h.includes('ano'))) && hasNatureza && (hasQtd || normHeaders.length <= 8)) {
      return { valid: true, format: 'indicators' };
    }

    // Formato 3: Microdados
    const hasMicroTime = normHeaders.some(h => h.includes('data') || h.includes('data_hora') || h.includes('data_fato'));
    if (hasMuni && hasNatureza && hasMicroTime) {
      return { valid: true, format: 'occurrences' };
    }

    return {
      valid: false,
      error: "Schema incompatível para SSP-PI. Colunas ausentes: cod_ibge / municipio, ano, mes / periodo, colunas de crimes ou natureza/indicador",
      missingColumns: ['municipio / cod_ibge', 'ano / mes', 'natureza / crimes']
    };
  }

  mapCrimeToCanonical(crimeText: string): string {
    if (!crimeText) return 'other';

    const norm = crimeText
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    for (const def of PI_CRIME_DEFINITIONS) {
      if (norm === def.key) {
        return def.category;
      }
    }

    if (norm.includes('tentativa de homicidio') || norm.includes('homicidio tentado')) {
      return 'bodily_harm';
    }
    if (norm.includes('tentativa de estupro')) {
      return 'sexual_crime';
    }

    const sortedDefs = [...PI_CRIME_DEFINITIONS].sort((a, b) => b.key.length - a.key.length);
    for (const def of sortedDefs) {
      if (norm.includes(def.key)) {
        return def.category;
      }
    }

    if (norm.includes('homicid') || norm.includes('assassin') || norm.includes('execucao') || norm.includes('feminicid') || norm.includes('latroc')) {
      return 'homicide';
    }
    if (norm.includes('roubo') || norm.includes('assalto') || norm.includes('arrastao')) {
      return 'robbery';
    }
    if (norm.includes('furto')) {
      return 'theft';
    }
    if (norm.includes('estupro') || norm.includes('sexual') || norm.includes('dignidade sexual') || norm.includes('assedio')) {
      return 'sexual_crime';
    }
    if (norm.includes('droga') || norm.includes('entorpecente') || norm.includes('cocaina') || norm.includes('maconha') || norm.includes('crack')) {
      return 'drug_related';
    }
    if (norm.includes('arma') || norm.includes('municao') || norm.includes('disparo')) {
      return 'other';
    }
    if (norm.includes('lesao') || norm.includes('agressao') || norm.includes('vias de fato')) {
      return 'bodily_harm';
    }

    return 'other';
  }

  private parsePeriod(row: any): string {
    const currentYear = new Date().getFullYear();
    let year = row['ano'] || row['Ano'] || row['ANO'] || currentYear;
    let monthRaw = row['mes'] || row['Mes'] || row['MES'] || row['mês'] || row['Mês'] || row['periodo'] || row['Periodo'] || '1';

    let monthStr = String(monthRaw).trim().toLowerCase();

    const monthMap: Record<string, string> = {
      'jan': '01', 'janeiro': '01', '1': '01', '01': '01',
      'fev': '02', 'fevereiro': '02', '2': '02', '02': '02',
      'mar': '03', 'marco': '03', 'março': '03', '3': '03', '03': '03',
      'abr': '04', 'abril': '04', '4': '04', '04': '04',
      'mai': '05', 'maio': '05', '5': '05', '05': '05',
      'jun': '06', 'junho': '06', '6': '06', '06': '06',
      'jul': '07', 'julho': '07', '7': '07', '07': '07',
      'ago': '08', 'agosto': '08', '8': '08', '08': '08',
      'set': '09', 'setembro': '09', '9': '09', '09': '09',
      'out': '10', 'outubro': '10', '10': '10',
      'nov': '11', 'novembro': '11', '11': '11',
      'dez': '12', 'dezembro': '12', '12': '12'
    };

    let mes = monthMap[monthStr];
    if (!mes) {
      if (typeof monthRaw === 'string' && monthRaw.includes('-')) {
        const parts = monthRaw.split('-');
        if (parts.length === 2 && parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}`;
        }
      }
      mes = '01';
    }

    return `${year}-${mes}`;
  }

  private extractMunicipality(row: any): { code: string; name: string } {
    const rawIbge = row['cod_ibge'] || row['COD_IBGE'] || row['ibge'] || row['IBGE'] || row['codigo_ibge'] || '';
    const rawName = row['municipio'] || row['Municipio'] || row['MUNICIPIO'] || row['cidade'] || row['Cidade'] || '';

    let code = String(rawIbge).trim();
    let name = String(rawName).trim();

    if (code.length === 6 && code.startsWith('22')) {
      code = code + '0';
    }

    if (!code || code === '0') {
      const canon = GeoNormalizationService.canonicalizeMunicipalityName(name);
      const piMunis: Record<string, string> = {
        'teresina': '2211001',
        'parnaiba': '2207702',
        'picos': '2208007',
        'piripiri': '2208403',
        'floriano': '2203909',
        'campo maior': '2202208',
        'barras': '2201200',
        'uniao': '2211100',
        'altos': '2200400',
        'esperantina': '2203701',
        'jose de freitas': '2205508',
        'pedro ii': '2207900',
        'oeiras': '2207009',
        'sao raimundo nonato': '2210003',
        'miguel alves': '2206209',
        'luis correia': '2205706',
        'piracuruca': '2208304'
      };

      if (piMunis[canon]) {
        code = piMunis[canon];
      }
    }

    return { code: code || 'UNKNOWN', name: name || 'Piauí' };
  }

  private parseNumeric(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const clean = String(val).replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.max(0, Math.round(num));
  }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    if (!row || typeof row !== 'object') return null;

    const normalizedKeys = Object.keys(row).reduce((acc, k) => {
      const normKey = k.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
      acc[normKey] = row[k];
      return acc;
    }, {} as Record<string, any>);

    const { code: muniCode } = this.extractMunicipality(row);
    const period = this.parsePeriod(row);

    // Formato Vertical (coluna 'natureza' / 'crime' / 'delito' / 'indicador')
    const naturezaCol = Object.keys(normalizedKeys).find(k => 
      k.includes('natureza') || k.includes('crime') || k.includes('delito') || k.includes('indicador')
    );

    if (naturezaCol && normalizedKeys[naturezaCol]) {
      const rawNat = String(normalizedKeys[naturezaCol]).trim();
      if (!rawNat) return null;

      const category = this.mapCrimeToCanonical(rawNat);
      const totalCol = Object.keys(normalizedKeys).find(k => 
        k.includes('total') || k.includes('quantidade') || k.includes('qtd') || k.includes('valor') || k.includes('ocorrencias') || k.includes('vitimas')
      );
      const value = totalCol ? this.parseNumeric(normalizedKeys[totalCol]) : 1;

      return [{
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-PI',
          datasetId: 'indicadores_municipais_pi',
          stateCode: 'PI',
          municipalityCode: muniCode,
          category,
          sourceCategory: rawNat,
          period,
          value,
          unit: (category === 'other' && (rawNat.toLowerCase().includes('arma') || rawNat.toLowerCase().includes('fogo'))) ? 'armas' : 'ocorrencias'
        }
      }];
    }

    // Formato Matricial (Wide): Múltiplas colunas de crimes
    const records: ParsedRecord[] = [];

    // 1. CVLI / Homicídios
    const homDoloso = this.parseNumeric(normalizedKeys['homicidio_doloso'] || normalizedKeys['homicidios_dolosos'] || normalizedKeys['homicidio']);
    const latrocinio = this.parseNumeric(normalizedKeys['latrocinio'] || normalizedKeys['latrocinios'] || normalizedKeys['roubo_seguido_de_morte']);
    const feminicidio = this.parseNumeric(normalizedKeys['feminicidio'] || normalizedKeys['feminicidios']);
    const lesaoMorte = this.parseNumeric(normalizedKeys['lesao_corporal_seguida_de_morte'] || normalizedKeys['lesao_morte']);
    const cvliTotal = this.parseNumeric(normalizedKeys['cvli'] || normalizedKeys['total_cvli'] || normalizedKeys['mortes_violentas'] || normalizedKeys['crimes_violentos_letais_intencionais']);

    const finalHomicide = cvliTotal > 0 ? cvliTotal : (homDoloso + latrocinio + feminicidio + lesaoMorte);
    if (finalHomicide > 0 || (normalizedKeys['homicidio_doloso'] !== undefined)) {
      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-PI',
          datasetId: 'indicadores_municipais_pi',
          stateCode: 'PI',
          municipalityCode: muniCode,
          category: 'homicide',
          sourceCategory: 'Crimes Violentos Letais Intencionais (CVLI)',
          period,
          value: finalHomicide,
          unit: 'vitimas'
        }
      });
    }

    // 2. Roubos Agregados (CVP)
    const rouboTrans = this.parseNumeric(normalizedKeys['roubo_transeunte'] || normalizedKeys['roubo_a_pessoa'] || normalizedKeys['roubo_em_via_publica'] || normalizedKeys['roubo_transeuntes']);
    const rouboCom = this.parseNumeric(normalizedKeys['roubo_comercio'] || normalizedKeys['roubo_a_comercio'] || normalizedKeys['roubo_estabelecimento']);
    const rouboRes = this.parseNumeric(normalizedKeys['roubo_residencia'] || normalizedKeys['roubo_a_residencia'] || normalizedKeys['roubo_habitacao']);
    const rouboCol = this.parseNumeric(normalizedKeys['roubo_coletivo'] || normalizedKeys['roubo_transporte_coletivo'] || normalizedKeys['roubo_em_onibus']);
    const rouboGen = this.parseNumeric(normalizedKeys['roubo'] || normalizedKeys['outros_roubos'] || normalizedKeys['total_roubos'] || normalizedKeys['cvp']);

    const finalRobbery = rouboGen > 0 ? rouboGen : (rouboTrans + rouboCom + rouboRes + rouboCol);
    if (finalRobbery > 0 || (normalizedKeys['roubo_transeunte'] !== undefined)) {
      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-PI',
          datasetId: 'indicadores_municipais_pi',
          stateCode: 'PI',
          municipalityCode: muniCode,
          category: 'robbery',
          sourceCategory: 'Roubos Agregados / CVP',
          period,
          value: finalRobbery,
          unit: 'ocorrencias'
        }
      });
    }

    // 3. Roubo de Veículos
    const rouboVeic = this.parseNumeric(normalizedKeys['roubo_veiculo'] || normalizedKeys['roubo_de_veiculo'] || normalizedKeys['roubo_de_veiculos']);
    if (rouboVeic > 0 || normalizedKeys['roubo_veiculo'] !== undefined) {
      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-PI',
          datasetId: 'indicadores_municipais_pi',
          stateCode: 'PI',
          municipalityCode: muniCode,
          category: 'vehicle_robbery',
          sourceCategory: 'Roubo de Veículos',
          period,
          value: rouboVeic,
          unit: 'ocorrencias'
        }
      });
    }

    // 4. Furto de Veículos
    const furtoVeic = this.parseNumeric(normalizedKeys['furto_veiculo'] || normalizedKeys['furto_de_veiculo'] || normalizedKeys['furto_de_veiculos']);
    if (furtoVeic > 0 || normalizedKeys['furto_veiculo'] !== undefined) {
      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-PI',
          datasetId: 'indicadores_municipais_pi',
          stateCode: 'PI',
          municipalityCode: muniCode,
          category: 'vehicle_theft',
          sourceCategory: 'Furto de Veículos',
          period,
          value: furtoVeic,
          unit: 'ocorrencias'
        }
      });
    }

    // 5. Furtos Gerais
    const furtoGen = this.parseNumeric(normalizedKeys['furto'] || normalizedKeys['furtos'] || normalizedKeys['furto_geral']);
    if (furtoGen > 0 || normalizedKeys['furto'] !== undefined) {
      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-PI',
          datasetId: 'indicadores_municipais_pi',
          stateCode: 'PI',
          municipalityCode: muniCode,
          category: 'theft',
          sourceCategory: 'Furtos Gerais',
          period,
          value: furtoGen,
          unit: 'ocorrencias'
        }
      });
    }

    // 6. Estupro / Crimes Sexuais
    const estuproVal = this.parseNumeric(normalizedKeys['estupro'] || normalizedKeys['estupro_de_vulneravel'] || normalizedKeys['crimes_sexuais']);
    if (estuproVal > 0 || normalizedKeys['estupro'] !== undefined) {
      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-PI',
          datasetId: 'indicadores_municipais_pi',
          stateCode: 'PI',
          municipalityCode: muniCode,
          category: 'sexual_crime',
          sourceCategory: 'Estupro e Estupro de Vulnerável',
          period,
          value: estuproVal,
          unit: 'vitimas'
        }
      });
    }

    // 7. Tráfico de Drogas
    const drogasVal = this.parseNumeric(normalizedKeys['trafico_drogas'] || normalizedKeys['trafico_de_drogas'] || normalizedKeys['entorpecentes']);
    if (drogasVal > 0 || normalizedKeys['trafico_drogas'] !== undefined) {
      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-PI',
          datasetId: 'indicadores_municipais_pi',
          stateCode: 'PI',
          municipalityCode: muniCode,
          category: 'drug_related',
          sourceCategory: 'Tráfico de Entorpecentes',
          period,
          value: drogasVal,
          unit: 'ocorrencias'
        }
      });
    }

    // 8. Apreensão de Armas
    const armasVal = this.parseNumeric(normalizedKeys['apreensao_armas'] || normalizedKeys['armas_apreendidas'] || normalizedKeys['apreensao_de_armas']);
    if (armasVal > 0 || normalizedKeys['apreensao_armas'] !== undefined) {
      records.push({
        target: 'indicators',
        data: {
          id: crypto.randomUUID(),
          sourceId: 'SSP-PI',
          datasetId: 'indicadores_municipais_pi',
          stateCode: 'PI',
          municipalityCode: muniCode,
          category: 'other',
          sourceCategory: 'Apreensão de Armas de Fogo',
          period,
          value: armasVal,
          unit: 'armas'
        }
      });
    }

    return records.length > 0 ? records : null;
  }
}
