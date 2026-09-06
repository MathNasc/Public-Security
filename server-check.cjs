const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
console.log(code.includes('/api/admin/data-quality') ? 'Has /api/admin/data-quality' : 'Missing /api/admin/data-quality');
console.log(code.includes('/api/data-sources') ? 'Has /api/data-sources' : 'Missing /api/data-sources');
