import fs from 'fs';
let code = fs.readFileSync('src/pages/Result.tsx', 'utf8');

code = code.replace(
  'if (!data || !lat || !lon) {', 
  'if (!data || data.error || !lat || !lon) {'
);

fs.writeFileSync('src/pages/Result.tsx', code);
