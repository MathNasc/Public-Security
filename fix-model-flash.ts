import fs from 'fs';

const filePath = 'src/services/SummaryService.ts';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(/model: 'gemini-[0-9\.]+-pro(?:-[a-z]+)?'/g, "model: 'gemini-3.8-flash'");

fs.writeFileSync(filePath, code);
