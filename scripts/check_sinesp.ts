import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

const basePath = 'raw_storage/SINESP';
if (fs.existsSync(basePath)) {
  const years = fs.readdirSync(basePath);
  for (const year of years) {
     const yearPath = path.join(basePath, year);
     if (fs.statSync(yearPath).isDirectory()) {
         const files = fs.readdirSync(yearPath);
         for (const file of files) {
             if (file.endsWith('.xlsx')) {
                 console.log('File:', file);
                 const wb = xlsx.readFile(path.join(yearPath, file), { sheetRows: 5 });
                 const sheetName = wb.SheetNames[0];
                 const sheet = wb.Sheets[sheetName];
                 const rows = xlsx.utils.sheet_to_json(sheet);
                 if (rows.length > 0) {
                     console.log('Headers:', Object.keys(rows[0]));
                 }
             }
         }
     }
  }
}
