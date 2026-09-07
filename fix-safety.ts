import fs from 'fs';
let code = fs.readFileSync('src/services/SafetyAnalysisService.ts', 'utf8');

code = code.replace(
  "canonicalCategory: 'ROUBO'", 
  "canonicalCategory: 'robbery'"
);
code = code.replace(
  "canonicalCategory: 'FURTO'", 
  "canonicalCategory: 'theft'"
);
code = code.replace(
  "canonicalCategory: 'FURTO_VEICULO'", 
  "canonicalCategory: 'vehicle_theft'"
);

fs.writeFileSync('src/services/SafetyAnalysisService.ts', code);
