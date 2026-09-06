const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace("app.get('/api/test', (req, res) => res.json({ok: true}));\n", "");
fs.writeFileSync('server.ts', code);
