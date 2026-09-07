import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'app.post("/api/admin/run-engine/ssp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));\n  } catch (error: any) {\n    res.status(500).json({ error: error.message });\n  }\n});',
  'app.post("/api/admin/run-engine/ssp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));'
);

code = code.replace(
  'app.post("/api/admin/run-engine/sinesp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));\n  } catch (error: any) {\n    res.status(500).json({ error: error.message });\n  }\n});',
  'app.post("/api/admin/run-engine/sinesp", (req, res) => res.json({ success: true, message: "Use the new JobManager API instead" }));'
);

fs.writeFileSync('server.ts', code);
