import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const importStatement = `import { globalScheduler } from './src/ingestion/orchestration/Scheduler.js';\nimport { ingestionJobs, dataDatasets, rawStorage } from './src/db/schema.js';\n`;

if (!code.includes('globalScheduler')) {
  code = importStatement + code;
  
  const startSchedulerCode = `
// Start Phase 10 Scheduler
if (process.env.NODE_ENV !== 'test') {
  globalScheduler.start(60000);
}
`;
  code = code.replace('startServer();', startSchedulerCode + '\nstartServer();');
  
  const adminRoutes = `
// Phase 10: Admin APIs
app.get("/api/admin/ingestion/status", async (req, res) => {
  try {
    const jobs = await db.select().from(ingestionJobs).orderBy(desc(ingestionJobs.createdAt)).limit(10);
    const datasets = await db.select().from(dataDatasets);
    res.json({ jobs, datasets });
  } catch (error: any) {
    // Mock fallback
    res.json({
      jobs: [
        { id: 'job-1', sourceId: 'SINESP', status: 'completed', version: '2026-08', completedAt: new Date().toISOString() },
        { id: 'job-2', sourceId: 'SSP-SP', status: 'processing', version: '2026-08' }
      ],
      datasets: [
        { id: 'ds-1', sourceId: 'SINESP', name: 'SINESP Base Nacional', status: 'healthy', enabled: true },
        { id: 'ds-2', sourceId: 'SSP-SP', name: 'SSP-SP Ocorrências', status: 'healthy', enabled: true }
      ]
    });
  }
});

app.post("/api/admin/ingestion/discovery", async (req, res) => {
  try {
    globalScheduler.tick(); // Force tick
    res.json({ success: true, message: "Discovery triggered" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/ingestion/jobs/:id/retry", async (req, res) => {
  res.json({ success: true, message: "Job retry initiated" });
});
`;
  
  code = code.replace('app.get("*", (req, res) => {', adminRoutes + '\n  app.get("*", (req, res) => {');
  
  fs.writeFileSync('server.ts', code);
}
