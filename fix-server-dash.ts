import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'const byCategory = {};\n    const byState = {};\n    const trend = {};',
  'const byCategory: Record<string, number> = {};\n    const byState: Record<string, number> = {};\n    const trend: Record<string, number> = {};'
);

fs.writeFileSync('server.ts', code);
