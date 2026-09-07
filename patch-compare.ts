import fs from 'fs';
let code = fs.readFileSync('src/pages/Compare.tsx', 'utf8');

code = code.replace(
  'if (error || !data1 || !data2) {',
  'if (error || !data1 || !data2 || data1.error || data2.error) {'
);

fs.writeFileSync('src/pages/Compare.tsx', code);
