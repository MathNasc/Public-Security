import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord, SchemaValidationResult } from '../BaseAdapter.js';
import { normalizeLegacyCategory } from '../../../services/Taxonomy.js';

// Mapeamento de Estados por extenso para Sigla UF
const STATE_NAME_TO_ACRONYM: Record<string, string> = {
  'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPA': 'AP', 'AMAZONAS': 'AM',
  'BAHIA': 'BA', 'CEARA': 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPIRITO SANTO': 'ES',
  'GOIAS': 'GO', 'MARANHAO': 'MA', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG', 'PARA': 'PA', 'PARAIBA': 'PB', 'PARANA': 'PR',
  'PERNAMBUCO': 'PE', 'PIAUI': 'PI', 'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS', 'RONDONIA': 'RO', 'RORAIMA': 'RR', 'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP', 'SERGIPE': 'SE', 'TOCANTINS': 'TO'
};

// Mapeamento de capitais e grandes municípios brasileiros para código IBGE (7 dígitos)
const COMMON_IBGE_MAP: Record<string, string> = {
  'SP_SAO PAULO': '3550308',
  'SP_CAMPINAS': '3509502',
  'SP_GUARULHOS': '3518800',
  'SP_SAO BERNARDO DO CAMPO': '3548708',
  'SP_SANTO ANDRE': '3547809',
  'SP_OSASCO': '3549904',
  'SP_SANTOS': '3548500',
  'SP_SAO JOSE DOS CAMPOS': '3549805',
  'SP_RIBEIRAO PRETO': '3543402',
  'SP_SOROCABA': '3552205',
  'RJ_RIO DE JANEIRO': '3304557',
  'RJ_SAO GONCALO': '3304904',
  'RJ_DUQUE DE CAXIAS': '3301702',
  'RJ_NOVA IGUACU': '3303500',
  'MG_BELO HORIZONTE': '3106200',
  'MG_UBERLANDIA': '3170206',
  'MG_CONTAGEM': '3118601',
  'BA_SALVADOR': '2927408',
  'BA_FEIRA DE SANTANA': '2910800',
  'PR_CURITIBA': '4106902',
  'RS_PORTO ALEGRE': '4314902',
  'PE_RECIFE': '2611606',
  'CE_FORTALEZA': '2304400',
  'DF_BRASILIA': '5300108',
  'GO_GOIANIA': '5208707',
  'AM_MANAUS': '1302603',
  'PA_BELEM': '1501402',
  'SC_FLORIANOPOLIS': '4205407',
  'ES_VITORIA': '3205309',
  'MA_SAO LUIS': '2111300',
  'MS_CAMPO GRANDE': '5002704',
  'MT_CUIABA': '5103403',
  'RN_NATAL': '2408102',
  'PB_JOAO PESSOA': '2507507',
  'AL_MACEIO': '2704302',
  'PI_TERESINA': '2211001',
  'SE_ARACAJU': '2800308',
  'RO_PORTO VELHO': '1100205',
  'TO_PALMAS': '1721000',
  'AP_MACAPA': '1600303',
  'RR_BOA VISTA': '1400100',
  'AC_RIO BRANCO': '1200401'
};

export class SinespAdapter extends BaseAdapter {
  // Nota arquitetural: O domínio legado dados.mj.gov.br foi descontinuado pelo Governo Federal.
  // A plataforma atual é dados.gov.br (com autenticação Bearer) e gov.br/mj (protegido por WAF).
  private legacyUrl = 'https://dados.mj.gov.br/dataset/210b1adee-588e-47f6-84d4-28247076a02b/resource/d4d12c82-c84a-4ff1-88f6-df21f37ccb83/download/indicadoressegurancapublicamunicipios.csv';
  private portalUrl = 'https://dados.gov.br/dados/conjuntos-dados/sistema-nacional-de-estatisticas-de-seguranca-publica';

  async discover(): Promise<DiscoveryResult> {
    const version = this.identifyVersion();
    return {
      source: 'SINESP',
      dataset: 'indicadores_municipais',
      url: this.portalUrl,
      version,
      checksum: crypto.createHash('sha256').update(`sinesp-${version}`).digest('hex')
    };
  }

  identifyVersion() {
    return '2024-01';
  }

  /**
   * O download remoto automatizado direto está bloqueado.
   * Não inventar fallback silencioso nem simular sucesso com fixtures locais.
   */
  async download(destinationPath: string): Promise<string> {
    throw new Error(
      `[SinespAdapter] Download automatizado indisponível: o endpoint remoto legado (dados.mj.gov.br) foi descontinuado pelo governo federal (DNS NXDOMAIN), e a nova plataforma dados.gov.br exige autenticação Bearer ou sessão interativa protegida por WAF. É obrigatório obter o arquivo CSV/XLSX oficial manualmente via portal governamental e realizar o upload via pipeline RAW Storage / /api/ingestion/upload.`
    );
  }

  metadata(): AdapterMetadata {
    return {
      name: 'Indicadores Criminais Municipais - SINESP (MJSP)',
      agency: 'Ministério da Justiça e Segurança Pública (MJSP) / SENASP',
      frequency: 'Mensal / Anual',
      coverage: 'Nacional (27 UFs)',
      limitations: [
        'STATUS: Download automatizado direto BLOQUEADO (URL legada descontinuada; API dados.gov.br requer Bearer token; WAF em gov.br)',
        'GRANULARIDADE: Apenas indicadores agregados por município e mês (geom=NULL, sem microdados pontuais)',
        'USO RESTRITO: Exclusivo para tabela security_indicators (nunca security_occurrences)',
        'SOBREPOSIÇÃO: Alto risco de duplicidade se somado diretamente com fontes estaduais (SSP-SP, etc.) sem controle de precedência',
        'REVISÕES HISTÓRICAS: Os dados consolidados sofrem revisões retroativas periódicas pela SENASP'
      ]
    };
  }

  /**
   * Validação rigorosa de Schema para arquivos SINESP de indicadores municipais.
   */
  validateSchema(headers: string[]): SchemaValidationResult {
    const cleanHeaders = headers.map(h => 
      h.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    const requiredConcepts = [
      { 
        name: 'UF', 
        aliases: ['UF', 'ESTADO', 'SIGLA UF', 'SIGLA_UF', 'SG_UF', 'REGIAO/UF'] 
      },
      { 
        name: 'Município', 
        aliases: ['MUNICIPIO', 'CIDADE', 'NOME MUNICIPIO', 'NOME_MUNICIPIO', 'NM_MUNICIPIO'] 
      },
      { 
        name: 'Tipo Crime', 
        aliases: ['TIPO CRIME', 'TIPO_CRIME', 'CRIME', 'NATUREZA', 'INDICADOR', 'TIPO_DE_CRIME', 'RUBRICA', 'EVENTO'] 
      },
      { 
        name: 'Ano / Período', 
        aliases: ['ANO', 'MES/ANO', 'MES_ANO', 'PERIODO', 'ANO_REFERENCIA'] 
      },
      { 
        name: 'Mês / Período', 
        aliases: ['MES', 'MES/ANO', 'MES_ANO', 'PERIODO', 'MES_REFERENCIA'] 
      },
      { 
        name: 'Ocorrências / Vítimas', 
        aliases: ['OCORRENCIAS', 'TOTAL', 'VALOR', 'QUANTIDADE', 'VITIMAS', 'QTDE', 'NUM_OCORRENCIAS', 'NUM_VITIMAS'] 
      }
    ];

    const missingColumns: string[] = [];
    for (const req of requiredConcepts) {
      const found = cleanHeaders.some(h => req.aliases.includes(h));
      if (!found) {
        missingColumns.push(req.name);
      }
    }

    if (missingColumns.length > 0) {
      return {
        valid: false,
        error: `Schema SINESP inválido. Conceitos obrigatórios ausentes: ${missingColumns.join(', ')}`,
        detectedColumns: cleanHeaders,
        missingColumns
      };
    }

    return {
      valid: true,
      format: 'indicators',
      detectedColumns: cleanHeaders
    };
  }

  /**
   * Mapeamento de rubricas criminais do SINESP para a taxonomia canônica nacional.
   */
  normalize(raw: string): string {
    const l = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    if (l.includes('homicidio doloso') || l.includes('feminicidio') || l.includes('latrocinio') || 
        l.includes('roubo seguido de morte') || l.includes('lesao corporal seguida de morte')) {
      return 'homicide';
    }
    if (l.includes('tentativa de homicidio')) {
      return 'assault';
    }
    if (l.includes('lesao corporal') || l.includes('lesao')) {
      return 'bodily_harm';
    }
    if (l.includes('roubo de veiculo')) {
      return 'vehicle_robbery';
    }
    if (l.includes('furto de veiculo')) {
      return 'vehicle_theft';
    }
    if (l.includes('roubo de carga')) {
      return 'cargo_theft';
    }
    if (l.includes('instituicao financeira') || l.includes('banco')) {
      return 'robbery';
    }
    if (l.includes('estupro')) {
      return 'sexual_crime';
    }
    if (l.includes('trafico') || l.includes('entorpecentes') || l.includes('drogas')) {
      return 'drug_related';
    }
    if (l.includes('roubo')) {
      return 'robbery';
    }
    if (l.includes('furto')) {
      return 'theft';
    }

    // Preserva integridade de categorias legadas ou mapeia preventivamente para 'other'
    const legacy = normalizeLegacyCategory(l);
    return legacy || 'other';
  }

  /**
   * Parsing resiliente de cada linha do arquivo SINESP.
   * Enforça ESTRITAMENTE target: 'indicators', nunca 'occurrences'.
   */
  parseRow(row: any): ParsedRecord | null {
    if (!row || typeof row !== 'object') return null;

    // Normalização das chaves do objeto
    const normalizedRow: Record<string, string> = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      normalizedRow[cleanKey] = typeof row[key] === 'string' ? row[key].trim() : String(row[key] ?? '');
    }

    // 1. UF / Estado
    const ufRaw = normalizedRow['UF'] || normalizedRow['ESTADO'] || normalizedRow['SIGLA UF'] || 
                  normalizedRow['SIGLA_UF'] || normalizedRow['SG_UF'] || normalizedRow['REGIAO/UF'] || '';
    let uf = ufRaw.trim().toUpperCase();
    if (uf.length > 2) {
      const cleanStateName = uf.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      uf = STATE_NAME_TO_ACRONYM[cleanStateName] || uf.substring(0, 2);
    }

    // 2. Município
    const cityRaw = normalizedRow['MUNICIPIO'] || normalizedRow['CIDADE'] || 
                    normalizedRow['NOME MUNICIPIO'] || normalizedRow['NOME_MUNICIPIO'] || 
                    normalizedRow['NM_MUNICIPIO'] || '';
    const city = cityRaw.trim();

    // 3. Código IBGE (se presente no arquivo)
    const ibgeRaw = normalizedRow['CODIGO IBGE'] || normalizedRow['CODIGO_IBGE'] || 
                    normalizedRow['COD_IBGE'] || normalizedRow['IBGE'] || 
                    normalizedRow['CD_MUNICIPIO'] || normalizedRow['CODIGO_MUNICIPIO'] || '';
    let codigoIbge: string | null = null;
    const cleanIbgeDigits = ibgeRaw.replace(/\D/g, '');
    if (cleanIbgeDigits.length === 7 || cleanIbgeDigits.length === 6) {
      codigoIbge = cleanIbgeDigits;
    }

    // 4. Tipo de Crime
    const crime = normalizedRow['TIPO CRIME'] || normalizedRow['TIPO_CRIME'] || 
                  normalizedRow['CRIME'] || normalizedRow['NATUREZA'] || 
                  normalizedRow['INDICADOR'] || normalizedRow['TIPO_DE_CRIME'] || 
                  normalizedRow['RUBRICA'] || '';

    // 5. Período (Ano e Mês)
    let ano: number | null = null;
    let mesNum: string | null = null;

    const anoRaw = normalizedRow['ANO'] || normalizedRow['ANO_REFERENCIA'];
    if (anoRaw) {
      const parsedAno = parseInt(anoRaw.replace(/\D/g, ''), 10);
      if (!isNaN(parsedAno) && parsedAno >= 1990 && parsedAno <= 2050) {
        ano = parsedAno;
      }
    }

    const mesRaw = normalizedRow['MES'] || normalizedRow['MES_REFERENCIA'];
    if (mesRaw) {
      mesNum = this.parseMonth(mesRaw);
    }

    // Suporte a coluna combinada 'MES/ANO' ou 'PERIODO'
    const periodoRaw = normalizedRow['MES/ANO'] || normalizedRow['MES_ANO'] || normalizedRow['PERIODO'];
    if (periodoRaw && (!ano || !mesNum)) {
      const parsed = this.parseCombinedPeriod(periodoRaw);
      if (parsed) {
        if (!ano) ano = parsed.year;
        if (!mesNum) mesNum = parsed.month;
      }
    }

    // 6. Valor e Unidade (Ocorrências vs Vítimas)
    let isVictimCount = false;
    let valorRaw = normalizedRow['OCORRENCIAS'] || normalizedRow['TOTAL'] || normalizedRow['VALOR'] || normalizedRow['QUANTIDADE'];
    if (!valorRaw && normalizedRow['VITIMAS']) {
      valorRaw = normalizedRow['VITIMAS'];
      isVictimCount = true;
    } else if (normalizedRow['NUM_VITIMAS']) {
      valorRaw = normalizedRow['NUM_VITIMAS'];
      isVictimCount = true;
    } else if (normalizedRow['QTDE']) {
      valorRaw = normalizedRow['QTDE'];
    }

    // Sanitização de valores nulos, vazios ou pontuados
    let valor = 0;
    if (valorRaw) {
      const sanitized = valorRaw.trim().replace(/\./g, '').replace(',', '.');
      if (sanitized === '-' || sanitized.toUpperCase() === 'N/D' || sanitized.toUpperCase() === 'NA' || 
          sanitized.toUpperCase() === 'ND' || sanitized.toUpperCase() === 'S/I' || sanitized === '') {
        valor = 0;
      } else {
        const parsedVal = parseFloat(sanitized);
        if (!isNaN(parsedVal) && parsedVal >= 0) {
          valor = Math.round(parsedVal);
        } else {
          return null; // Valor numérico inválido/corrompido
        }
      }
    }

    // Validações mínimas obrigatórias de qualidade
    if (!uf || uf.length !== 2 || !city || !crime || !ano || !mesNum) {
      return null;
    }

    // Resolução de IBGE se não veio na coluna
    const cleanCity = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    if (!codigoIbge) {
      const key = `${uf}_${cleanCity}`;
      codigoIbge = COMMON_IBGE_MAP[key] || null;
    }

    const normalizedCategory = this.normalize(crime);

    return {
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SINESP',
        datasetId: 'indicadores_municipais',
        stateCode: uf,
        municipalityCode: codigoIbge,
        municipalityName: city,
        category: normalizedCategory,
        sourceCategory: crime,
        period: `${ano}-${mesNum}`,
        value: valor,
        unit: isVictimCount ? 'victims' : 'occurrences'
      }
    };
  }

  private parseMonth(mesStr: string): string | null {
    if (!mesStr) return null;
    const clean = mesStr.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const monthMap: Record<string, string> = {
      'janeiro': '01', 'jan': '01', '1': '01', '01': '01',
      'fevereiro': '02', 'fev': '02', '2': '02', '02': '02',
      'marco': '03', 'mar': '03', '3': '03', '03': '03',
      'abril': '04', 'abr': '04', '4': '04', '04': '04',
      'maio': '05', 'mai': '05', '5': '05', '05': '05',
      'junho': '06', 'jun': '06', '6': '06', '06': '06',
      'julho': '07', 'jul': '07', '7': '07', '07': '07',
      'agosto': '08', 'ago': '08', '8': '08', '08': '08',
      'setembro': '09', 'set': '09', '9': '09', '09': '09',
      'outubro': '10', 'out': '10', '10': '10',
      'novembro': '11', 'nov': '11', '11': '11',
      'dezembro': '12', 'dez': '12', '12': '12'
    };

    return monthMap[clean] || null;
  }

  private parseCombinedPeriod(periodStr: string): { year: number; month: string } | null {
    if (!periodStr) return null;
    const clean = periodStr.trim();

    // Formato MM/YYYY ou M/YYYY
    const slashMatch = clean.match(/^(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const m = slashMatch[1].padStart(2, '0');
      const y = parseInt(slashMatch[2], 10);
      return { year: y, month: m };
    }

    // Formato YYYY-MM
    const dashMatch = clean.match(/^(\d{4})-(\d{1,2})$/);
    if (dashMatch) {
      const y = parseInt(dashMatch[1], 10);
      const m = dashMatch[2].padStart(2, '0');
      return { year: y, month: m };
    }

    // Formato MesTexto/YYYY (ex: JAN/2024 ou JANEIRO/2024)
    const textSlashMatch = clean.match(/^([a-zA-ZçÇ]+)\/(\d{4})$/);
    if (textSlashMatch) {
      const m = this.parseMonth(textSlashMatch[1]);
      const y = parseInt(textSlashMatch[2], 10);
      if (m) return { year: y, month: m };
    }

    return null;
  }
}
