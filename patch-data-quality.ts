import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'console.error("Error fetching data quality:", error);',
  'console.warn("Error fetching data quality (DB missing?):", error.message);'
);

fs.writeFileSync('server.ts', code);
