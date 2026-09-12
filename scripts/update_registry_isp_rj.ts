import { db } from '../src/db/index.js';
import { sourceRegistry } from '../src/db/schema.js';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

async function run() {
  await db.insert(sourceRegistry).values({
    id: crypto.randomUUID(),
    state: 'RJ',
    institution: 'Instituto de Segurança Pública (ISP-RJ)',
    sourceName: 'ISP Dados',
    officialPage: 'https://www.ispdados.rj.gov.br/estatistica.html',
    downloadMethod: 'GET',
    contentType: 'text/csv',
    fileFormat: 'CSV',
    granularity: 'municipality',
    hasCoordinates: false,
    hasMunicipalityData: true,
    hasStateData: true,
    acquisitionMode: 'automatic',
    automatable: true,
    status: 'verified',
    evidenceLevel: 'E5',
    notes: 'Base do ISP Dados (RJ) automatizada com sucesso extraindo BaseMunicipioMensal.csv e outras bases CSV.',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log('Registry updated for ISP-RJ.');
}
run();
