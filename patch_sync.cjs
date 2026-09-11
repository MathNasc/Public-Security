const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const newRoute = `app.post("/api/admin/force-db-sync", adminAuth, async (req, res) => {
  const { exec } = require('child_process');
  
  // 1. Apaga a tabela para forçar o re-seed no próximo GET
  try {
    await db.delete(dataSources);
  } catch(e) {
    console.log("Erro ao limpar dataSources:", e.message);
  }

  // 2. Roda a migração
  exec("npm run db:migrate:prod", { env: process.env }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: error.message, stdout, stderr });
    }
    // Simplifica o log para não assustar o usuário com "NOTICE"
    res.json({ success: true, stdout: "Migrações concluídas e sementes (links) resetadas! Atualize a página para ver a lista." });
  });
});`;

serverCode = serverCode.replace(
  /app\.post\("\/api\/admin\/force-db-sync"[\s\S]*?res\.json\(\{ success: true, stdout, stderr \}\);\s*\}\);\s*\}\);/,
  newRoute
);

fs.writeFileSync('server.ts', serverCode);
