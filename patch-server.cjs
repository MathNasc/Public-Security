const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

const newImports = `
import { IngestionEngine } from './src/ingestion/core/IngestionEngine.js';
import { SinespAdapter } from './src/ingestion/adapters/federal/sinesp/SinespAdapter.js';
import { dataSources, dataImports, securityOccurrences, securityIndicators } from './src/db/schema.js';
`;

// Insert imports if not present
if (!code.includes('IngestionEngine')) {
  code = code.replace(/import express from "express";/, newImports + 'import express from "express";');
}

// Ensure the new engine trigger route exists
const engineRoute = `
app.post("/api/admin/run-engine/sinesp", async (req, res) => {
  try {
    const engine = new IngestionEngine();
    const sinesp = new SinespAdapter();
    // Run in background
    engine.runJob(sinesp).catch(console.error);
    res.json({ success: true, message: "Engine started for SINESP in the background." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
`;

if (!code.includes('/api/admin/run-engine/sinesp')) {
  code = code.replace('app.get("/api/health"', engineRoute + '\napp.get("/api/health"');
}

// Fix /api/admin/data-quality to read from security_occurrences
code = code.replace(/from\(occurrences\)/g, "from(securityOccurrences)");
code = code.replace(/occurrences\./g, "securityOccurrences.");

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with Ingestion Engine route and updated occurrences ref");
