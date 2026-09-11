const fs = require('fs');
let code = fs.readFileSync('docker-compose.yml', 'utf8');

if (!code.includes('env_file:')) {
  code = code.replace(
    /    environment:/,
    "    env_file:\n      - .env\n    environment:"
  );
  fs.writeFileSync('docker-compose.yml', code);
}
