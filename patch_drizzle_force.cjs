const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(
  /exec\("npx drizzle-kit push",/g,
  'exec("npx drizzle-kit push --force",'
);
fs.writeFileSync('server.ts', serverCode);

let dockerCode = fs.readFileSync('docker-compose.yml', 'utf8');
dockerCode = dockerCode.replace(
  /npx drizzle-kit push &&/g,
  'npx drizzle-kit push --force &&'
);
fs.writeFileSync('docker-compose.yml', dockerCode);
