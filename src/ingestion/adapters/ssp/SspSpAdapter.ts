import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord, SchemaValidationResult } from '../BaseAdapter.js';
import { normalizeLegacyCategory } from '../../../services/Taxonomy.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as XLSX from 'xlsx';

/**
 * Adapter oficial para SSP-SP (Secretaria de Segurança Pública de São Paulo)
 * 
 * Suporta três estruturas oficiais da SSP-SP:
 * 1. Microdados de Boletins de Ocorrência (BO pontuais com latitude/longitude, endereço e DP)
 * 2. Séries Estatísticas Mensais por Município - Formato Horizontal (colunas Janeiro..Dezembro ou Jan..Dez)
 * 3. Séries Estatísticas Mensais por Município - Formato Vertical (coluna Mês e Total/Ocorrências)
 */
export class SspSpAdapter extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Secretaria de Segurança Pública de São Paulo - SSP-SP",
      agency: "SSP-SP",
      frequency: "Mensal",
      coverage: "SP",
      limitations: [
        "Atraso de publicação oficial de cerca de 25 dias úteis no mês subsequente",
        "Coordenadas geográficas presentes no formato de microdados (BO), ausentes nas tabelas agregadas municipais",
        "Nomes de municípios na base histórica podem conter abreviações (ex: S. Paulo, Mogi-Mirim, Embu)"
      ]
    };
  }

  identifyVersion(): string {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  }

  /**
   * Descoberta automatizada e dinâmica da última publicação disponível na API oficial da SSP-SP.
   */
  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    let latestMonth = 1;
    const targetYear = currentYear;

    try {
      // 1. Consulta agrupada oficial da SSP-SP para identificar o último mês publicado
      const checkUrl = `https://www.ssp.sp.gov.br/v1/OcorrenciasMensais/RecuperaDadosMensaisAgrupados?ano=${currentYear}&grupoDelito=6&tipoGrupo=ESTADO&idGrupo=0`;
      const res = await axios.get(checkUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (res.data?.success && res.data?.data?.[0]?.listaDados) {
        const monthCols = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        for (const d of res.data.data[0].listaDados) {
          for (let i = 0; i < 12; i++) {
            if (typeof d[monthCols[i]] === 'number' && d[monthCols[i]] > 0) {
              if (i + 1 > latestMonth) latestMonth = i + 1;
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(`[SSP-SP Adapter] Aviso ao consultar discovery online: ${e.message}. Usando mês corrente.`);
      latestMonth = Math.max(1, new Date().getMonth());
    }

    const version = `${targetYear}-${String(latestMonth).padStart(2, '0')}`;
    const officialExportUrl = `https://www.ssp.sp.gov.br/v1/OcorrenciasMensais/ExportarMensal?ano=${targetYear}&grupoDelito=6&tipoGrupo=${encodeURIComponent('MUNICÍPIO')}&idGrupo=565`;

    return {
      source: "SSP-SP",
      dataset: "ocorrencias_criminais_sp",
      url: officialExportUrl,
      version,
      checksum: crypto.createHash('sha256').update(`ssp-sp-${version}-${targetYear}`).digest('hex')
    };
  }

  /**
   * Aquisição automática real dos dados publicados pela SSP-SP.
   * Baixa a planilha oficial XLSX do endpoint público da SSP-SP e converte em CSV padronizado.
   */
  async download(destinationPath: string): Promise<string> {
    const discovery = await this.discover();
    console.log(`[SSP-SP Adapter] Iniciando download automatizado real do endpoint oficial: ${discovery.url}`);
    
    let rawBuffer: Buffer | null = null;
    let lastError: Error | null = null;

    // Retry com backoff exponencial para resiliência de rede pública
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await axios.get(discovery.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*'
          },
          responseType: 'arraybuffer',
          timeout: 25000
        });

        if (response.status === 200 && response.data && response.data.length > 0) {
          rawBuffer = Buffer.from(response.data);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[SSP-SP Adapter] Tentativa ${attempt}/3 de download falhou (${err.message}). Aguardando retry...`);
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }

    if (!rawBuffer || rawBuffer.length === 0) {
      throw new Error(`Falha na aquisição do arquivo oficial da SSP-SP: ${lastError?.message || 'Arquivo vazio recebido'}`);
    }

    // Preserva o arquivo binário XLSX original oficial da SSP-SP no RAW storage
    const rawXlsxPath = destinationPath.endsWith('.csv') 
      ? destinationPath.replace(/\.csv$/, '.xlsx') 
      : `${destinationPath}.xlsx`;
    
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.writeFileSync(rawXlsxPath, rawBuffer);
    console.log(`[SSP-SP Adapter] Arquivo XLSX oficial bruto persistido em: ${rawXlsxPath} (${rawBuffer.length} bytes)`);

    // Converte o arquivo XLSX oficial da SSP-SP para o formato tabular CSV esperado pelo pipeline
    const wb = XLSX.read(rawBuffer, { type: 'buffer' });
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const header = ['Municipio', 'Natureza', 'Ano', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Total'];
    const csvLines = [header.join(',')];
    const currentYear = new Date().getFullYear();

    for (let i = 1; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!r || r.length < 2) continue;
      const natureza = String(r[0] || '').trim();
      if (!natureza) continue;

      const values = [];
      for (let m = 1; m <= 12; m++) {
        let v = r[m];
        if (v === '...' || v === undefined || v === null) v = '0';
        values.push(String(v).replace(/\./g, '').trim());
      }
      const total = String(r[13] || '0').replace(/\./g, '').trim();
      csvLines.push([
        `"São Paulo"`,
        `"${natureza.replace(/"/g, '""')}"`,
        currentYear,
        ...values,
        total
      ].join(','));
    }

    const csvContent = csvLines.join('\n');
    fs.writeFileSync(destinationPath, csvContent, 'utf-8');
    console.log(`[SSP-SP Adapter] Arquivo CSV estruturado gerado com sucesso: ${destinationPath} (${csvLines.length - 1} naturezas criminais)`);

    return destinationPath;
  }

  /**
   * Validação antecipada e rigorosa de Schema antes do processamento linha a linha.
   */
  validateSchema(headers: string[]): SchemaValidationResult {
    const cleanHeaders = headers.map(h => 
      h.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    // Formato 1: Microdados de Ocorrência / Boletim de Ocorrência (BO)
    const hasBo = cleanHeaders.some(h => ['NUM_BO', 'NUMERO_BO', 'NUMERO_BOLETIM', 'BO_NUMERO', 'BO_NRO'].includes(h));
    const hasData = cleanHeaders.some(h => ['DATAOCORRENCIA', 'DATA_OCORRENCIA', 'DATA_FATO', 'DATA'].includes(h));
    const hasCrime = cleanHeaders.some(h => ['NATUREZA_APURADA', 'RUBRICA', 'NATUREZA', 'CRIME', 'DESCR_CONDUTA'].includes(h));

    if (hasBo && hasData && hasCrime) {
      return {
        valid: true,
        format: 'occurrences',
        detectedColumns: cleanHeaders
      };
    }

    // Formato 2 e 3: Indicadores Mensais por Município
    const hasMun = cleanHeaders.some(h => ['MUNICIPIO', 'CIDADE', 'NOME_MUNICIPIO'].includes(h));
    const hasNatureza = cleanHeaders.some(h => ['NATUREZA', 'CRIME', 'TIPO_CRIME', 'RUBRICA'].includes(h));
    
    // Meses horizontais
    const horizontalMonthKeys = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
                                 'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const matchedMonths = cleanHeaders.filter(h => horizontalMonthKeys.includes(h));

    // Mês vertical
    const hasMesCol = cleanHeaders.some(h => ['MES', 'PERIODO'].includes(h));
    const hasTotalCol = cleanHeaders.some(h => ['TOTAL', 'VALOR', 'QUANTIDADE', 'OCORRENCIAS', 'REGISTROS'].includes(h));

    if (hasMun && hasNatureza && (matchedMonths.length >= 2 || (hasMesCol && hasTotalCol))) {
      return {
        valid: true,
        format: 'indicators',
        detectedColumns: cleanHeaders
      };
    }

    // Se nenhum dos formatos oficiais for reconhecido:
    const missing: string[] = [];
    if (!hasBo && !hasNatureza) missing.push('NUM_BO ou Natureza');
    if (!hasData && !hasMesCol && matchedMonths.length < 2) missing.push('DATAOCORRENCIA ou Mês/Ano');
    if (!hasCrime && !hasNatureza) missing.push('NATUREZA_APURADA ou Natureza');

    return {
      valid: false,
      error: `Schema não reconhecido para SSP-SP. Esperava microdados de BO (NUM_BO, DATAOCORRENCIA, NATUREZA_APURADA) ou série temporal municipal (Município, Natureza, Total/Mês). Colunas ausentes: ${missing.join(', ')}`,
      detectedColumns: cleanHeaders,
      missingColumns: missing
    };
  }

  /**
   * Converte uma linha em um ou mais registros canônicos (ParsedRecord)
   */
  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    if (!row || typeof row !== 'object') return null;

    // Normalização das chaves do objeto para busca case-insensitive e sem acentos
    const normalizedRow: Record<string, string> = {};
    for (const key of Object.keys(row)) {
      const cleanKey = key.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      normalizedRow[cleanKey] = typeof row[key] === 'string' ? row[key].trim() : String(row[key] ?? '');
    }

    // 1. DETECÇÃO DE FORMATO: Microdados de Ocorrência (BO)
    const numBo = normalizedRow['NUM_BO'] || normalizedRow['NUMERO_BO'] || normalizedRow['NUMERO_BOLETIM'] || normalizedRow['BO_NUMERO'] || normalizedRow['BO_NRO'];
    const dataOcorrencia = normalizedRow['DATAOCORRENCIA'] || normalizedRow['DATA_OCORRENCIA'] || normalizedRow['DATA_FATO'] || normalizedRow['DATA'];
    const crimeStr = normalizedRow['NATUREZA_APURADA'] || normalizedRow['RUBRICA'] || normalizedRow['NATUREZA'] || normalizedRow['CRIME'] || normalizedRow['DESCR_CONDUTA'];

    if (numBo && dataOcorrencia) {
      return this.parseOccurrenceRow(normalizedRow, numBo, dataOcorrencia, crimeStr || 'OUTROS');
    }

    // 2. DETECÇÃO DE FORMATO: Indicadores Mensais por Município (Horizontal ou Vertical)
    const natureza = normalizedRow['NATUREZA'] || normalizedRow['CRIME'] || normalizedRow['TIPO_CRIME'] || normalizedRow['RUBRICA'];
    const municipio = normalizedRow['MUNICIPIO'] || normalizedRow['CIDADE'] || normalizedRow['NOME_MUNICIPIO'];
    if (natureza && municipio) {
      return this.parseIndicatorRow(normalizedRow, natureza, municipio);
    }

    return null;
  }

  /**
   * Processamento de linha de Boletim de Ocorrência pontual
   */
  private parseOccurrenceRow(row: Record<string, string>, numBo: string, dataOcorrencia: string, crimeStr: string): ParsedRecord | null {
    // Tratamento e validação de data
    let occurredAt: Date | null = null;
    let year: number | null = null;
    let month: number | null = null;

    const hora = row['HORAOCORRENCIA'] || row['HORA_OCORRENCIA'] || row['HORA'] || '00:00';
    const dateParts = dataOcorrencia.split(/[\/\-]/);
    if (dateParts.length === 3) {
      let d: number, m: number, y: number;
      if (dateParts[0].length === 4) {
        y = parseInt(dateParts[0], 10);
        m = parseInt(dateParts[1], 10);
        d = parseInt(dateParts[2], 10);
      } else {
        d = parseInt(dateParts[0], 10);
        m = parseInt(dateParts[1], 10);
        y = parseInt(dateParts[2], 10);
      }
      
      const [h, min] = hora.split(':').map(n => parseInt(n, 10) || 0);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        occurredAt = new Date(Date.UTC(y, m - 1, d, h || 0, min || 0, 0));
        year = y;
        month = m;
      }
    }

    // Se ano_bo estiver explícito, pode sobrescrever se ano inferido for inválido
    const anoBo = parseInt(row['ANO_BO'] || row['ANO'] || '', 10);
    if ((!year || isNaN(year)) && !isNaN(anoBo) && anoBo > 1990) {
      year = anoBo;
      month = month || 1;
      occurredAt = new Date(Date.UTC(year, 0, 1));
    }

    // Validação de sanidade temporal básica (rejeita datas impossíveis ou corrompidas)
    const currentYear = new Date().getFullYear();
    if (!year || isNaN(year) || year < 1990 || year > currentYear + 1) {
      return null;
    }

    // Mapeamento canônico via taxonomia
    const canonicalCategory = this.mapCrimeToCanonical(crimeStr);

    // Coordenadas geográficas
    let latitude: number | null = null;
    let longitude: number | null = null;

    const latRaw = (row['LATITUDE'] || row['LAT'])?.replace(',', '.').trim();
    const lonRaw = (row['LONGITUDE'] || row['LONG'] || row['LON'])?.replace(',', '.').trim();
    if (latRaw && lonRaw) {
      const latParsed = parseFloat(latRaw);
      const lonParsed = parseFloat(lonRaw);
      if (!isNaN(latParsed) && !isNaN(lonParsed)) {
        latitude = latParsed;
        longitude = lonParsed;
      }
    }

    // Endereço e Cidade
    const logradouro = row['LOGRADOURO'] || row['ENDERECO'] || '';
    const numero = row['NUMERO_LOGRADOURO'] || row['NUMERO'] || row['NRO_LOGRADOURO'] || '';
    const originalAddress = logradouro ? (numero ? `${logradouro}, ${numero}` : logradouro) : null;
    const cidade = row['CIDADE'] || row['MUNICIPIO'] || row['NOME_MUNICIPIO'] || 'São Paulo';

    const sourceRecordId = `${year}-${numBo}`;

    return {
      target: 'occurrences',
      data: {
        id: crypto.randomUUID(),
        source_id: 'SSP-SP',
        dataset_id: 'ocorrencias_criminais_sp',
        source_record_id: sourceRecordId,
        country: 'BR',
        state_code: 'SP',
        state_name: 'São Paulo',
        municipality_name: cidade,
        category: canonicalCategory,
        source_category: crimeStr,
        occurred_at: occurredAt,
        year,
        month,
        latitude,
        longitude,
        original_address: originalAddress,
        source_data: JSON.stringify({
          bairro: row['BAIRRO'] || null,
          descricao_local: row['DESCRICAO_LOCAL'] || row['TIPO_LOCAL'] || null,
          delegacia: row['DELEGACIA_NOME'] || row['DP'] || null
        })
      }
    };
  }

  /**
   * Processamento de linha de Indicadores Estatísticos (Tabelas Agregadas SSP-SP)
   * Suporta tanto formato horizontal (Janeiro..Dezembro / Jan..Dez) quanto vertical (Mês / Total)
   */
  private parseIndicatorRow(row: Record<string, string>, natureza: string, municipioStr: string): ParsedRecord[] {
    const records: ParsedRecord[] = [];
    const canonicalCategory = this.mapCrimeToCanonical(natureza);
    const municipio = municipioStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    
    // Tratamento de ano
    let ano = parseInt(row['ANO'] || '', 10);
    if (isNaN(ano) || ano < 1990) {
      ano = new Date().getFullYear();
    }

    // Dicionário de mapeamento de meses (extenso e abreviado)
    const meses = [
      { keys: ['JANEIRO', 'JAN'], num: '01' },
      { keys: ['FEVEREIRO', 'FEV'], num: '02' },
      { keys: ['MARCO', 'MAR'], num: '03' },
      { keys: ['ABRIL', 'ABR'], num: '04' },
      { keys: ['MAIO', 'MAI'], num: '05' },
      { keys: ['JUNHO', 'JUN'], num: '06' },
      { keys: ['JULHO', 'JUL'], num: '07' },
      { keys: ['AGOSTO', 'AGO'], num: '08' },
      { keys: ['SETEMBRO', 'SET'], num: '09' },
      { keys: ['OUTUBRO', 'OUT'], num: '10' },
      { keys: ['NOVEMBRO', 'NOV'], num: '11' },
      { keys: ['DEZEMBRO', 'DEZ'], num: '12' }
    ];

    // 1. FORMATO VERTICAL: Coluna MES / PERIODO e TOTAL / VALOR
    const mesCol = row['MES'] || row['PERIODO'];
    const totalCol = row['TOTAL'] || row['VALOR'] || row['QUANTIDADE'] || row['OCORRENCIAS'] || row['REGISTROS'];

    if (mesCol !== undefined && totalCol !== undefined) {
      const monthNum = this.resolveMonthNumber(mesCol, meses);
      const val = this.parseNumericValue(totalCol);
      if (monthNum && val !== null) {
        records.push({
          target: 'indicators',
          data: {
            id: crypto.randomUUID(),
            sourceId: 'SSP-SP',
            datasetId: 'indicadores_municipais_sp',
            stateCode: 'SP',
            municipalityCode: null,
            municipalityName: municipio,
            category: canonicalCategory,
            sourceCategory: natureza,
            period: `${ano}-${monthNum}`,
            value: val,
            unit: 'occurrences'
          }
        });
      }
      return records;
    }

    // 2. FORMATO HORIZONTAL: Colunas individuais para cada mês
    for (const m of meses) {
      // Procura qualquer uma das chaves do mês (ex: 'JANEIRO' ou 'JAN')
      let valRaw: string | undefined;
      for (const k of m.keys) {
        if (row[k] !== undefined) {
          valRaw = row[k];
          break;
        }
      }

      if (valRaw !== undefined) {
        const val = this.parseNumericValue(valRaw);
        if (val !== null) {
          records.push({
            target: 'indicators',
            data: {
              id: crypto.randomUUID(),
              sourceId: 'SSP-SP',
              datasetId: 'indicadores_municipais_sp',
              stateCode: 'SP',
              municipalityCode: null,
              municipalityName: municipio,
              category: canonicalCategory,
              sourceCategory: natureza,
              period: `${ano}-${m.num}`,
              value: val,
              unit: 'occurrences'
            }
          });
        }
      }
    }

    return records;
  }

  /**
   * Converte valores textuais de planilhas oficiais (ex: "1.250", "-", "N/D", " 0 ") em número seguro.
   */
  private parseNumericValue(raw: string): number | null {
    if (raw === undefined || raw === null) return null;
    const clean = raw.trim();
    if (clean === '' || clean === '-' || clean === '.' || clean.toUpperCase() === 'N/D' || clean.toUpperCase() === 'ND' || clean.toUpperCase() === 'S/I') {
      return 0;
    }
    // Remove separadores de milhar como ponto ("1.250" -> "1250")
    const sanitized = clean.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(sanitized);
    return isNaN(num) ? null : Math.max(0, Math.round(num));
  }

  /**
   * Converte representações diversas de meses (número, extenso, abreviação) para "01".."12"
   */
  private resolveMonthNumber(rawMonth: string, meses: { keys: string[]; num: string }[]): string | null {
    if (!rawMonth) return null;
    const clean = rawMonth.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Se for numérico
    const n = parseInt(clean, 10);
    if (!isNaN(n) && n >= 1 && n <= 12) {
      return String(n).padStart(2, '0');
    }

    // Se for texto por extenso ou sigla
    for (const m of meses) {
      if (m.keys.some(k => clean === k || clean.startsWith(k))) {
        return m.num;
      }
    }

    return null;
  }

  /**
   * Mapeamento exaustivo e canônico de tipificações da SSP-SP para a Taxonomia Nacional Canônica.
   * Não descarta categorias desconhecidas — mapeia para 'other' mantendo a source_category original.
   */
  public mapCrimeToCanonical(rawCrime: string): string {
    if (!rawCrime) return 'other';
    const clean = rawCrime.toUpperCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Crimes Letais Intencionais
    if (clean.includes('LATROCINIO')) return 'homicide';
    if (clean.includes('HOMICIDIO DOLOSO')) return 'homicide';
    if (clean.includes('LESAO CORPORAL SEGUIDA DE MORTE')) return 'homicide';
    if (clean.includes('FEMINICIDIO')) return 'homicide';

    // Tentativas e Agressões
    if (clean.includes('TENTATIVA DE HOMICIDIO')) return 'assault';
    if (clean.includes('LESAO CORPORAL DOLOSA')) return 'bodily_harm';

    // Crimes de Trânsito ou Culposos
    if (clean.includes('CULPOSO')) return 'other';

    // Crimes Contra o Patrimônio - Veículos
    if (clean.includes('ROUBO DE VEICULO')) return 'vehicle_robbery';
    if (clean.includes('FURTO DE VEICULO')) return 'vehicle_theft';

    // Crimes Contra o Patrimônio - Carga
    if (clean.includes('ROUBO DE CARGA')) return 'cargo_theft';
    if (clean.includes('FURTO DE CARGA')) return 'theft';

    // Roubos e Furtos Gerais
    if (clean.includes('ROUBO')) return 'robbery';
    if (clean.includes('FURTO')) return 'theft';
    if (clean.includes('EXTORSAO')) return 'robbery';

    // Crimes Sexuais
    if (clean.includes('ESTUPRO')) return 'sexual_crime';

    // Entorpecentes
    if (clean.includes('ENTORPECENTE') || clean.includes('TRAFICO') || clean.includes('DROGA')) return 'drug_related';

    // Fallback seguro: normaliza categoria legada ou classifica como 'other'
    const fallback = normalizeLegacyCategory(rawCrime.toLowerCase());
    return fallback || 'other';
  }
}
