const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

const newImports = `
import { IbgeSyncService } from './src/ingestion/adapters/geographic/ibge/IbgeSyncService.js';
import { geographicStates, geographicMunicipalities } from './src/db/schema.js';
`;

if (!code.includes('IbgeSyncService')) {
  code = code.replace(/import express from "express";/, newImports + 'import express from "express";');
}

const ibgeRoute = `
app.post("/api/admin/run-engine/ibge", async (req, res) => {
  try {
    const service = new IbgeSyncService();
    // Run in background
    service.syncAll().catch(console.error);
    res.json({ success: true, message: "Engine started for IBGE Geographic Sync in the background." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
`;

if (!code.includes('/api/admin/run-engine/ibge')) {
  code = code.replace('app.post("/api/admin/run-engine/sinesp"', ibgeRoute + '\napp.post("/api/admin/run-engine/sinesp"');
}

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with IBGE engine route");
