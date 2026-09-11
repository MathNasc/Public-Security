const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement = `app.get("/api/data-sources", async (req, res) => {
  try {
    let sources = await db.select().from(dataSources);
    
    // Auto-seed se o banco estiver vazio
    if (sources.length === 0) {
      const seedData = [
        { id: 'SINESP', name: 'SINESP Base Nacional', provider: 'Ministério da Justiça', coverage: 'Nacional', status: 'Ativo' },
        { id: 'SSP-SP', name: 'Estatísticas Criminais', provider: 'Secretaria de Segurança Pública SP', coverage: 'SP', status: 'Ativo' },
        { id: 'ISP-RJ', name: 'BaseDP Mensal', provider: 'Instituto de Segurança Pública RJ', coverage: 'RJ', status: 'Ativo' },
        { id: 'SSP-MG', name: 'Ocorrências Criminais', provider: 'SEJUSP MG', coverage: 'MG', status: 'Ativo' },
        { id: 'SESP-PR', name: 'Estatísticas SESP', provider: 'Secretaria de Segurança Pública PR', coverage: 'PR', status: 'Pendente' },
        { id: 'SSP-RS', name: 'Indicadores Criminais', provider: 'Secretaria de Segurança Pública RS', coverage: 'RS', status: 'Pendente' }
      ];
      
      await db.insert(dataSources).values(seedData.map(s => ({
        ...s,
        createdAt: new Date(),
        updatedAt: new Date()
      }))).onConflictDoNothing();
      
      sources = await db.select().from(dataSources);
    }
    
    res.json(sources || []);
  } catch (err: any) {
    if (err.message && err.message.includes("ENOTFOUND")) {
      res.json([]);
    } else {
      res.status(500).json({ error: "Failed to fetch data sources" });
    }
  }
});`;

code = code.replace(/app\.get\("\/api\/data-sources"[\s\S]*?\}\);/, replacement);
fs.writeFileSync('server.ts', code);
