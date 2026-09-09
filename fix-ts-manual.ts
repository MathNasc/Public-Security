import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// There is an extra "});" around line 500
code = code.replace(/    \}\n    \n  \}\);\n\}\n/g, '    }\n}\n');
fs.writeFileSync('server.ts', code);
