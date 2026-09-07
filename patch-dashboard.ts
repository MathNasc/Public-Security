import fs from 'fs';
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  'if (!data || data.total === 0) {',
  'if (!data || data.error || data.total === undefined || data.total === 0) {'
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
