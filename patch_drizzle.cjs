const fs = require('fs');

let dockerCode = fs.readFileSync('docker-compose.yml', 'utf8');
dockerCode = dockerCode.replace(
  /npx drizzle-kit push --force &&/g,
  'npx drizzle-kit push &&'
);
fs.writeFileSync('docker-compose.yml', dockerCode);

let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(
  /npx drizzle-kit push --force/g,
  'npx drizzle-kit push'
);
fs.writeFileSync('server.ts', serverCode);

