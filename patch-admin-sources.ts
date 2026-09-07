import fs from 'fs';
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

code = code.replace(
  '{(sources || []).map(source => (',
  '{(Array.isArray(sources) ? sources : []).map(source => ('
);

code = code.replace(
  '{sources.length === 0 && (',
  '{(!Array.isArray(sources) || sources.length === 0) && ('
);

fs.writeFileSync('src/pages/Admin.tsx', code);
