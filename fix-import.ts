import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('import { SafetyAnalysisService }')) {
  code = code.replace('app.get("/api/analysis",', 'import { SafetyAnalysisService } from "./src/services/SafetyAnalysisService.js";\n\napp.get("/api/analysis",');
  fs.writeFileSync('server.ts', code);
}
