import * as fs from 'fs';
import { parse } from 'csv-parse';

export async function parseSspCsv(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const records: any[] = [];
    fs.createReadStream(filePath)
      .pipe(parse({
        columns: true,      // Automatically use the first row as headers
        delimiter: [';', ','], // SSP sometimes uses semicolon instead of comma
        trim: true,
        skip_empty_lines: true
      }))
      .on('data', (record) => {
        records.push(record);
      })
      .on('end', () => {
        resolve(records);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}
