import * as fs from 'fs';
import { parse } from 'csv-parse';

export function createSspCsvStream(filePath: string) {
  return fs.createReadStream(filePath)
    .pipe(parse({
      columns: true,
      delimiter: [';', ','],
      trim: true,
      skip_empty_lines: true
    }));
}
