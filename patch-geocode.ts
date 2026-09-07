import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  'const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query as string)}&format=json&limit=5`;',
  'const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query as string)}&format=json&addressdetails=1&limit=5&countrycodes=br`;'
);
fs.writeFileSync('server.ts', code);
