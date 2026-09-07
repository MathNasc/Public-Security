import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'service.syncAll().catch(console.error);',
  'service.syncAll().catch(e => console.warn("Sync failed:", e.message));'
);

fs.writeFileSync('server.ts', code);
