import { db } from '../src/db/index.js';
import { securityOccurrences, dataImports } from '../src/db/schema.js';

async function run() {
  console.log('Deletando todas as ocorrências de segurança antigas/sintéticas...');
  await db.delete(securityOccurrences);
  
  console.log('Resetando o status dos arquivos importados para reprocessamento...');
  await db.update(dataImports).set({
    status: 'pending',
    recordsProcessed: 0,
    errorLog: null,
    processingStartedAt: null,
    processingEndedAt: null
  });
  
  console.log('Banco de dados limpo. Pronto para importação real completa.');
}
run();
