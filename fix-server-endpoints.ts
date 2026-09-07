import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "import { SinespAdapter } from './src/ingestion/adapters/federal/sinesp/SinespAdapter.js';",
  "// Removed SinespAdapter old import"
);
code = code.replace(
  "import { SspSpAdapter } from './src/ingestion/adapters/ssp-sp/SspSpAdapter.js';",
  "// Removed SspSpAdapter old import"
);

// We should replace the run-engine endpoints to just return error or use the JobManager.
// Let's just mock them as they are deprecated by Phase 5's JobManager.
code = code.replace(
  /app\.post\("\/api\/admin\/run-engine\/ssp"[\s\S]*?res\.json\({ success: true, result }\);\n  \} catch \(err\) {\n    console\.error\(err\);\n    res\.status\(500\)\.json\({ error: "Erro interno no motor" }\);\n  }\n}\);/g,
  'app.post("/api/admin/run-engine/ssp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));'
);

code = code.replace(
  /app\.post\("\/api\/admin\/run-engine\/sinesp"[\s\S]*?res\.json\({ success: true, result }\);\n  \} catch \(err\) {\n    console\.error\(err\);\n    res\.status\(500\)\.json\({ error: "Erro interno" }\);\n  }\n}\);/g,
  'app.post("/api/admin/run-engine/sinesp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));'
);

fs.writeFileSync('server.ts', code);
