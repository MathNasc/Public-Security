const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /exec\("npx drizzle-kit push", \{ env: process\.env \},/,
  'exec("npx drizzle-kit push:pg", { env: process.env },'
);
fs.writeFileSync('server.ts', code);
