const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const mountStatement = `\n// Public API with Rate Limiting\napp.use('/api/public', publicRouter);\n\napp.get("/api/admin/data-quality"`;

code = code.replace(/app\.get\("\/api\/admin\/data-quality"/g, mountStatement);

fs.writeFileSync('server.ts', code);
console.log("Mounted publicRouter properly");
