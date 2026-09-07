import fs from 'fs';
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

if (!code.includes('import React')) {
  code = "import React from 'react';\n" + code;
  fs.writeFileSync('src/pages/Admin.tsx', code);
}
