const fs = require('fs');
let code = fs.readFileSync('src/db/index.ts', 'utf8');

if (!code.includes('source_type TEXT')) {
  code = code.replace(
    "origin_url TEXT,",
    "origin_url TEXT,\n      source_type TEXT,\n      environment TEXT,\n      is_official_publication BOOLEAN,\n      is_eligible_for_production_automation BOOLEAN,"
  );
  fs.writeFileSync('src/db/index.ts', code);
}
