const fs = require('fs');
let dockerfile = fs.readFileSync('Dockerfile', 'utf8');

// Insert generate before copying
dockerfile = dockerfile.replace(
  /RUN npm run build/,
  'RUN npm run build\nRUN npx drizzle-kit generate'
);

fs.writeFileSync('Dockerfile', dockerfile);
