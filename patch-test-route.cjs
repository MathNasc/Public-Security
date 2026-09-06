const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace("app.use('/api/public', publicRouter);", "app.get('/api/test', (req, res) => res.json({ok: true}));\napp.use('/api/public', publicRouter);");
fs.writeFileSync('server.ts', code);
