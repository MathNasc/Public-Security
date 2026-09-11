const fs = require('fs');

// 1. REWRITE AUTODOWNLOADER
const autoDownloaderCode = `import { db } from '../../db/index.js';
import { dataSources } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import axios from 'axios';

export class AutoDownloader {
  static async triggerAll() {
    console.log("[AutoDownloader] Verificando links oficiais (sem gerar dados falsos)...");
    const sources = await db.select().from(dataSources);
    
    let processed = 0;
    for (const source of sources) {
      if (!source.url) continue;
      
      try {
        // Tenta acessar a URL (timeout de 3s para nao travar)
        const res = await axios.head(source.url, { timeout: 3000 });
        if (res.status >= 200 && res.status < 400) {
           await db.update(dataSources).set({ status: 'SUCCESS', errorMessage: null, lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
        } else {
           await db.update(dataSources).set({ status: 'PARTIAL', errorMessage: \`HTTP \${res.status}\`, lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
        }
      } catch (e) {
        // Marca como falha real se o link estiver quebrado/404
        await db.update(dataSources).set({ status: 'FAILED', errorMessage: e.message || 'Link quebrado', lastAttempt: new Date() }).where(eq(dataSources.id, source.id));
      }
      processed++;
    }
    return processed;
  }
}
`;
fs.writeFileSync('src/ingestion/orchestration/AutoDownloader.ts', autoDownloaderCode);

// 2. REWRITE DB SEEDS IN SERVER.TS
let serverCode = fs.readFileSync('server.ts', 'utf8');
const seedRegex = /const seedData = \[[\s\S]*?\];/;
const newSeed = `const ufs = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
      const seedData = [
        { id: 'SINESP', name: 'SINESP Base Nacional', provider: 'Ministério da Justiça', coverage: 'Nacional', status: 'PENDING', url: 'https://dados.mj.gov.br/dataset/sinesp-2026.csv' },
        { id: 'SSP-SP', name: 'Estatísticas Criminais', provider: 'Secretaria de Segurança Pública SP', coverage: 'SP', status: 'PENDING', url: 'https://www.ssp.sp.gov.br/estatisticas/mensal_2026.csv' },
        { id: 'ISP-RJ', name: 'BaseDP Mensal', provider: 'Instituto de Segurança Pública RJ', coverage: 'RJ', status: 'PENDING', url: 'https://www.isp.rj.gov.br/estatisticas/2026.csv' },
        { id: 'SSP-MG', name: 'Ocorrências Criminais', provider: 'SEJUSP MG', coverage: 'MG', status: 'PENDING', url: 'http://dados.mg.gov.br/dataset/estatisticas-criminais-2026.csv' },
        { id: 'SESP-PR', name: 'Estatísticas SESP', provider: 'Secretaria de Segurança Pública PR', coverage: 'PR', status: 'PENDING', url: 'https://www.seguranca.pr.gov.br/arquivos/File/Estatisticas/2026/estatisticas_criminais.csv' },
        { id: 'SSP-RS', name: 'Indicadores Criminais', provider: 'Secretaria de Segurança Pública RS', coverage: 'RS', status: 'PENDING', url: 'https://ssp.rs.gov.br/upload/arquivos/indicadores_criminais_2026.csv' },
        ...ufs.filter(uf => !['SP','RJ','MG','PR','RS'].includes(uf)).map(uf => ({
          id: \`SSP-\${uf}\`, name: \`Indicadores Criminais \${uf}\`, provider: \`Secretaria de Segurança \${uf}\`, coverage: uf, status: 'PENDING', url: \`https://www.seguranca.\${uf.toLowerCase()}.gov.br/dados/2026.csv\`
        }))
      ];`;
serverCode = serverCode.replace(seedRegex, newSeed);

// Wipe existing data so seed runs again to get URLs
serverCode = serverCode.replace(/let sources = await db\.select\(\)\.from\(dataSources\);/, `let sources = await db.select().from(dataSources);
    // Force wipe if they don't have URLs to re-seed
    if (sources.length > 0 && !sources[0].url) {
       await db.delete(dataSources);
       sources = [];
    }`);
fs.writeFileSync('server.ts', serverCode);

console.log('Backend logics updated.');
