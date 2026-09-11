const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(
  /npx drizzle-kit push --force --accept-data-loss/g,
  'npx drizzle-kit push --force'
);
fs.writeFileSync('server.ts', serverCode);

let dockerCode = fs.readFileSync('docker-compose.yml', 'utf8');
dockerCode = dockerCode.replace(
  /npx drizzle-kit push --force --accept-data-loss/g,
  'npx drizzle-kit push --force'
);
fs.writeFileSync('docker-compose.yml', dockerCode);
