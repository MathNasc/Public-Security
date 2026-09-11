const fs = require('fs');

let dockerfile = fs.readFileSync('Dockerfile', 'utf8');
dockerfile = dockerfile.replace(
  /COPY --from=builder \/app\/drizzle\.config\.ts \.\//g,
  'COPY --from=builder /app/drizzle.config.ts ./\nCOPY --from=builder /app/drizzle-pg ./drizzle-pg'
);
fs.writeFileSync('Dockerfile', dockerfile);

