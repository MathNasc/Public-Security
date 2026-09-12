import { db } from '../src/db/index.js';
import { securityOccurrences, dataImports } from '../src/db/schema.js';
import { inArray, notInArray } from 'drizzle-orm';
import fs from 'fs';

async function run() {
  console.log('Deletando TUDO (hard reset)...');
  await db.delete(securityOccurrences);
  await db.delete(dataImports);
  
  // Clean raw_storage directory
  if (fs.existsSync('./raw_storage')) {
     fs.rmSync('./raw_storage', { recursive: true, force: true });
     console.log('Diretório raw_storage limpo.');
  }
  
  console.log('Banco zerado. Agora vamos rodar os Crawlers novamente.');
}
run();
