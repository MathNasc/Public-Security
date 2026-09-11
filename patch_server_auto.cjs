const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importStatement = "import { AutoDownloader } from './src/ingestion/orchestration/AutoDownloader.js';\n";
if (!code.includes("AutoDownloader")) {
  code = code.replace(/import \{ IngestionWorker \}/, `${importStatement}import { IngestionWorker }`);
}

const triggerEndpoint = `
app.post("/api/admin/automation/trigger-all", adminAuth, async (req, res) => {
  try {
    const jobs = await AutoDownloader.triggerAll();
    res.json({ success: true, message: \`\${jobs} fontes foram processadas (downloads + importações agendadas). O Worker está inserindo os dados no PostGIS em background.\` });
  } catch (err: any) {
    console.error("Erro na automação:", err);
    res.status(500).json({ error: "Falha ao acionar a automação" });
  }
});
`;

if (!code.includes("/api/admin/automation/trigger-all")) {
  code = code.replace(/app\.post\("\/api\/admin\/download-sample"/, `${triggerEndpoint}\napp.post("/api/admin/download-sample"`);
}

// Ensure the worker starts correctly
code = code.replace(
  /const ingestionWorker = new IngestionWorker\(\);/,
  `const ingestionWorker = new IngestionWorker();\n  ingestionWorker.start().catch(console.error);`
);

fs.writeFileSync('server.ts', code);
