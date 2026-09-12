/**
 * Parser Streaming SAX de alta performance para arquivos XLSX gigantes da SSP-SP.
 * Descomprime e processa XML sob demanda via stream sem sobrecarregar a memória RAM.
 */
import { spawn } from 'child_process';
import fs from 'fs';

export interface XlsxRowCallback {
  (rowNum: number, rowData: Record<string, string>, headers: string[]): void | Promise<void>;
}

export interface StreamXlsxOptions {
  sheetXmlPath?: string; // ex: 'xl/worksheets/sheet1.xml' ou 'xl/worksheets/sheet3.xml'
  maxRows?: number;
  batchSize?: number;
  onBatch?: (batch: Array<{ rowNum: number; row: Record<string, string> }>) => Promise<void>;
}

export class StreamingXlsxParser {
  /**
   * Converte letra de coluna Excel (A, B, ..., Z, AA, AB, ..., AZ) em índice numérico 0-based.
   */
  static colLetterToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  /**
   * Carrega apenas a tabela de Shared Strings de forma streaming.
   */
  static async loadSharedStrings(xlsxPath: string): Promise<string[]> {
    const start = Date.now();
    const child = spawn('unzip', ['-p', xlsxPath, 'xl/sharedStrings.xml']);
    const strings: string[] = [];

    let chunk = '';
    for await (const data of child.stdout) {
      chunk += data.toString();
      let idx;
      while ((idx = chunk.indexOf('</si>')) !== -1) {
        const siBlock = chunk.substring(0, idx);
        chunk = chunk.substring(idx + 5);
        const match = siBlock.match(/<t[^>]*>(.*?)<\/t>/gs);
        if (match) {
          const text = match.map(m => m.replace(/<[^>]+>/g, '')).join('');
          strings.push(text);
        } else {
          strings.push('');
        }
      }
    }

    console.log(`[StreamingXlsxParser] Carregou ${strings.length} shared strings em ${Date.now() - start}ms`);
    return strings;
  }

  /**
   * Identifica dinamicamente a planilha principal dentro do arquivo XLSX.
   */
  static async getWorksheetPath(xlsxPath: string): Promise<string> {
    return new Promise((resolve) => {
      const child = spawn('unzip', ['-l', xlsxPath]);
      let output = '';
      child.stdout.on('data', (d) => { output += d.toString(); });
      child.on('close', () => {
        const lines = output.split('\n');
        // Procura a maior planilha ou a primeira planilha de dados
        let bestSheet = 'xl/worksheets/sheet1.xml';
        let maxSize = 0;

        for (const line of lines) {
          const match = line.match(/\s+(\d+)\s+.*?(xl\/worksheets\/sheet\d+\.xml)/i);
          if (match) {
            const size = parseInt(match[1], 10);
            const sheetPath = match[2];
            if (size > maxSize) {
              maxSize = size;
              bestSheet = sheetPath;
            }
          }
        }
        resolve(bestSheet);
      });
    });
  }

  /**
   * Faz o streaming SAX linha a linha da planilha sem carregar o XML em RAM.
   */
  static async streamWorksheet(
    xlsxPath: string,
    options: StreamXlsxOptions,
    onRow?: XlsxRowCallback
  ): Promise<{ totalRows: number; headers: string[] }> {
    if (!fs.existsSync(xlsxPath)) {
      throw new Error(`Arquivo não encontrado para streaming: ${xlsxPath}`);
    }

    const sharedStrings = await this.loadSharedStrings(xlsxPath);
    const sheetXmlPath = options.sheetXmlPath || (await this.getWorksheetPath(xlsxPath));
    console.log(`[StreamingXlsxParser] Iniciando streaming de: ${sheetXmlPath} em ${xlsxPath}`);

    const child = spawn('unzip', ['-p', xlsxPath, sheetXmlPath]);
    let headers: string[] = [];
    let totalRows = 0;
    let currentBatch: Array<{ rowNum: number; row: Record<string, string> }> = [];
    const batchSize = options.batchSize || 1000;

    let chunk = '';
    const start = Date.now();

    for await (const data of child.stdout) {
      chunk += data.toString();
      let rowIdx;
      while ((rowIdx = chunk.indexOf('</row>')) !== -1) {
        const rowXml = chunk.substring(0, rowIdx);
        chunk = chunk.substring(rowIdx + 6);

        // Extrai número da linha do atributo r="N"
        const rowNumMatch = rowXml.match(/<row[^>]+r="(\d+)"/);
        if (!rowNumMatch) continue;
        const rowNum = parseInt(rowNumMatch[1], 10);

        // Regex streaming de células: <c r="A1" t="s"><v>123</v></c> ou <c r="B1"><v>456</v></c>
        const cellRegex = /<c\s+r="([A-Z]+)(\d+)"(?:[^>]*?t="([^"]*)")?[^>]*?(?:>(?:.*?<v>([^<]*)<\/v>)?.*?<\/c>|\/>)/gs;
        const rowCells: Record<number, string> = {};

        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
          const colStr = cellMatch[1];
          const cellType = cellMatch[3];
          const cellValue = cellMatch[4];
          const colIndex = this.colLetterToIndex(colStr);

          let resolvedVal = '';
          if (cellValue !== undefined) {
            if (cellType === 's') {
              const strIdx = parseInt(cellValue, 10);
              resolvedVal = sharedStrings[strIdx] ?? '';
            } else {
              resolvedVal = cellValue;
            }
          }
          rowCells[colIndex] = resolvedVal;
        }

        if (rowNum === 1) {
          // Headers
          const maxCol = Math.max(...Object.keys(rowCells).map(Number), 0);
          headers = [];
          for (let i = 0; i <= maxCol; i++) {
            const h = (rowCells[i] || `COL_${i}`)
              .trim()
              .toUpperCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
            headers.push(h);
          }
        } else {
          totalRows++;
          const rowData: Record<string, string> = {};
          for (let i = 0; i < headers.length; i++) {
            rowData[headers[i]] = rowCells[i] || '';
          }

          if (onRow) {
            await onRow(rowNum, rowData, headers);
          }

          if (options.onBatch) {
            currentBatch.push({ rowNum, row: rowData });
            if (currentBatch.length >= batchSize) {
              await options.onBatch(currentBatch);
              currentBatch = [];
            }
          }

          if (options.maxRows && totalRows >= options.maxRows) {
            child.kill();
            break;
          }
        }
      }

      if (options.maxRows && totalRows >= options.maxRows) {
        break;
      }
    }

    if (options.onBatch && currentBatch.length > 0) {
      await options.onBatch(currentBatch);
      currentBatch = [];
    }

    console.log(`[StreamingXlsxParser] Finalizado streaming de ${totalRows} linhas em ${Date.now() - start}ms`);
    return { totalRows, headers };
  }
}
