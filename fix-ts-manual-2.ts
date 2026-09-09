import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// The file ends with });\n} instead of just }
code = code.replace(/    \}\n\}\);\n\}/g, '    }\n}');
fs.writeFileSync('server.ts', code);
