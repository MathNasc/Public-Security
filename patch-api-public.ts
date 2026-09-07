import fs from 'fs';
let code = fs.readFileSync('src/api/public.ts', 'utf8');

code = code.replace(
  'console.error("API Error (Indicators):", error);',
  'console.warn("API Error (Indicators):", error.message);'
);

code = code.replace(
  'console.error("API Error (Occurrences):", error);',
  'console.warn("API Error (Occurrences):", error.message);'
);

fs.writeFileSync('src/api/public.ts', code);
