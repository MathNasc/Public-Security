import fs from 'fs';

const filePath = 'src/services/SummaryService.ts';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(/model: 'gemini-2\.5-pro'/g, "model: 'gemini-3.1-pro-preview'");

fs.writeFileSync(filePath, code);
