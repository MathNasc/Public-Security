import { db } from '../../src/db/index.js';
import { sourceRegistry } from '../../src/db/schema.js';

async function run() {
  const sources = await db.select().from(sourceRegistry);
  console.log(`--- PORTAIS DE DADOS MAPEADOS: ${sources.length} ---`);
  
  const automatables = sources.filter(s => s.automatable);
  const manuals = sources.filter(s => !s.automatable);
  
  console.log(`\n✅ AUTOMATIZÁVEIS (Baixam sozinhos via Downloader / Nível E5+): ${automatables.length}`);
  for (const s of automatables) {
    console.log(`  - ${s.state}: ${s.institution} (${s.sourceName})`);
  }
  
  console.log(`\n❌ NÃO AUTOMATIZÁVEIS (Exigem Upload Manual ou Crawler de Navegador / E0-E4): ${manuals.length}`);
  for (const s of manuals) {
    console.log(`  - ${s.state}: ${s.status} | ${s.notes.substring(0, 80)}...`);
  }
}
run();
