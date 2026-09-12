const fs = require('fs');
let code = fs.readFileSync('src/db/index.ts', 'utf8');

const target = `      acquisition_method TEXT DEFAULT 'MANUAL_UPLOAD',
      origin_url TEXT,
      parser_used TEXT,`;

const replacement = `      acquisition_method TEXT DEFAULT 'MANUAL_UPLOAD',
      origin_url TEXT,
      source_type TEXT,
      environment TEXT,
      is_official_publication BOOLEAN,
      is_eligible_for_production_automation BOOLEAN,
      parser_used TEXT,`;

code = code.replace(target, replacement);
fs.writeFileSync('src/db/index.ts', code);
