const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const importStatement = `
import { SspSpAdapter } from './src/ingestion/adapters/ssp-sp/SspSpAdapter.js';
import { IngestionEngine } from './src/ingestion/core/IngestionEngine.js';
`;

if (!code.includes('SspSpAdapter')) {
  code = code.replace(/import express from "express";/, importStatement + 'import express from "express";');
}

const sspRoute = `
app.post("/api/admin/run-engine/ssp", async (req, res) => {
  try {
    const engine = new IngestionEngine();
    const sspAdapter = new SspSpAdapter();
    // Run in background
    engine.runJob(sspAdapter).catch(console.error);
    res.json({ success: true, message: "Engine started for SSP-SP in the background." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
`;

if (!code.includes('/api/admin/run-engine/ssp')) {
  code = code.replace('app.post("/api/admin/run-engine/sinesp"', sspRoute + '\napp.post("/api/admin/run-engine/sinesp"');
}

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with SSP-SP engine route");
