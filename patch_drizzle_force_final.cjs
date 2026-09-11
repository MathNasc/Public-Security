const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// just verifying the string is correct
code = code.replace(
  /exec\("npx drizzle-kit push --force", \{ env: process\.env \},/,
  'exec("npx drizzle-kit push --force --accept-data-loss", { env: process.env },'
);
fs.writeFileSync('server.ts', code);

let dockerCode = fs.readFileSync('docker-compose.yml', 'utf8');
dockerCode = dockerCode.replace(
  /npx drizzle-kit push --force &&/,
  'npx drizzle-kit push --force --accept-data-loss &&'
);
fs.writeFileSync('docker-compose.yml', dockerCode);
