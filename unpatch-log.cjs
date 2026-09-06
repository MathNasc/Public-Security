const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/app\._router\.stack\.forEach\([\s\S]*?\}\);/g, '');
fs.writeFileSync('server.ts', code);
