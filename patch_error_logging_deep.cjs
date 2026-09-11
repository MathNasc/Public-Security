const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /res\.status\(500\)\.json\(\{ error: "Falha: " \+ \(err\.message \|\| String\(err\)\) \+ " \| Detalhes: Verifique o console do container" \}\);/,
  'const rootCause = err.cause ? (err.cause.message || err.cause) : err.message; res.status(500).json({ error: "Falha: " + rootCause });'
);
fs.writeFileSync('server.ts', code);
