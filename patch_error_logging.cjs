const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /res\.status\(500\)\.json\(\{ error: "Falha ao acionar a automação" \}\);/,
  'res.status(500).json({ error: "Falha ao acionar a automação: " + (err.message || String(err)) });'
);
fs.writeFileSync('server.ts', code);
