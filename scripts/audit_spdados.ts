import { spawn } from 'child_process';
import readline from 'readline';

// 1. Shared Strings Loader
export async function loadSharedStrings(xlsxPath: string): Promise<string[]> {
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
  console.log(`[SharedStrings] Loaded ${strings.length} strings in ${Date.now() - start}ms`);
  return strings;
}

// Convert Excel column letters (A, B, ..., Z, AA, AB, ..., AD) to 0-based index
function colLetterToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

export interface RowCallback {
  (rowNum: number, rowData: Record<string, string>, headers: string[]): void;
}

// 2. Stream Worksheet
export async function streamSheet(
  xlsxPath: string,
  sheetXmlPath: string,
  sharedStrings: string[],
  onRow: RowCallback,
  maxRows?: number
): Promise<{ totalRows: number; headers: string[] }> {
  const child = spawn('unzip', ['-p', xlsxPath, sheetXmlPath]);
  let headers: string[] = [];
  let totalRows = 0;

  let chunk = '';
  for await (const data of child.stdout) {
    chunk += data.toString();
    let rowIdx;
    while ((rowIdx = chunk.indexOf('</row>')) !== -1) {
      const rowXml = chunk.substring(0, rowIdx);
      chunk = chunk.substring(rowIdx + 6);

      // parse row number
      const rowNumMatch = rowXml.match(/<row[^>]+r="(\d+)"/);
      if (!rowNumMatch) continue;
      const rowNum = parseInt(rowNumMatch[1], 10);

      // Parse cells <c r="A1" t="s"><v>123</v></c>
      const cellRegex = /<c\s+r="([A-Z]+)(\d+)"(?:[^>]*?t="([^"]*)")?[^>]*?(?:>(?:.*?<v>([^<]*)<\/v>)?.*?<\/c>|\/>)/gs;
      const rowCells: Record<number, string> = {};

      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
        const colStr = cellMatch[1];
        const cellType = cellMatch[3];
        const cellValue = cellMatch[4];
        const colIndex = colLetterToIndex(colStr);

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
          headers.push(rowCells[i] || `COL_${i}`);
        }
      } else {
        totalRows++;
        const rowData: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
          rowData[headers[i]] = rowCells[i] ?? '';
        }
        onRow(rowNum, rowData, headers);

        if (maxRows && totalRows >= maxRows) {
          child.kill();
          return { totalRows, headers };
        }
      }
    }
  }

  return { totalRows, headers };
}
