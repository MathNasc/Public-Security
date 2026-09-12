import { db } from '../src/db/index.js';
import { sourceRegistry } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function run() {
  await db.update(sourceRegistry)
    .set({ 
      officialPage: 'https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023',
      acquisitionMode: 'automatic',
      automatable: true,
      status: 'verified',
      evidenceLevel: 'E5',
      notes: 'Download automatizado de arquivos XLSX via API Plone do Gov.br implementado com sucesso.'
    })
    .where(eq(sourceRegistry.institution, 'Ministério da Justiça e Segurança Pública (MJSP)'));

  await db.update(sourceRegistry)
    .set({ 
      officialPage: 'https://www.portal.ssp.sp.gov.br/estatistica/consultas',
      acquisitionMode: 'manual_upload',
      automatable: false,
      status: 'manual_only',
      evidenceLevel: 'E6',
      notes: 'Página atualizada para Angular SPA. Sem links diretos estáticos de arquivos. Extração requer uso de APIs internas ou navegação.'
    })
    .where(eq(sourceRegistry.institution, 'Secretaria de Segurança Pública de São Paulo (SSP-SP)'));
    
  console.log('Registry updated.');
}
run();
