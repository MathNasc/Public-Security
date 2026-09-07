import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /app\.post\("\/api\/admin\/run-engine\/ssp", async \(req, res\) => \{[\s\S]*?\}\);/,
  'app.post("/api/admin/run-engine/ssp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));'
);

code = code.replace(
  /app\.post\("\/api\/admin\/run-engine\/sinesp", async \(req, res\) => \{[\s\S]*?\}\);/,
  'app.post("/api/admin/run-engine/sinesp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));'
);

fs.writeFileSync('server.ts', code);
