import xlsx from 'xlsx';
import fs from 'fs';
const wb = xlsx.read(fs.readFileSync('ba_outros.xlsx'), { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log('Rows:', data.slice(0, 5));
