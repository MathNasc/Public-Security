const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

if (!code.includes('ArrowUpRight')) {
  code = code.replace(/import { ShieldAlert, Activity, /g, 'import { ArrowUpRight, ShieldAlert, Activity, ');
  fs.writeFileSync('src/pages/Admin.tsx', code);
}
