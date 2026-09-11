const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// I will improve the error logging in server.ts to be even more descriptive
code = code.replace(
  /res\.status\(500\)\.json\(\{ error: "Falha ao acionar a automação: " \+ \(err\.message \|\| String\(err\)\) \}\);/,
  'res.status(500).json({ error: "Falha: " + (err.message || String(err)) + " | Detalhes: Verifique o console do container" });'
);
fs.writeFileSync('server.ts', code);
