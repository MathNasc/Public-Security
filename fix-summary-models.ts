import fs from 'fs';

const filePath = 'src/services/SummaryService.ts';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /const modelsToTry = \[.*?\];/s,
  `const modelsToTry = [
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash'
    ];`
);

fs.writeFileSync(filePath, code);
