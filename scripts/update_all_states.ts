import { db } from '../src/db/index.js';
import { sourceRegistry } from '../src/db/schema.js';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

async function run() {
  const sources = [
    {
      id: crypto.randomUUID(), state: 'MG', institution: 'Secretaria de Estado de Justiça e Segurança Pública (SEJUSP-MG)',
      sourceName: 'Dados Abertos SEJUSP-MG', officialPage: 'https://www.seguranca.mg.gov.br/', status: 'unavailable', evidenceLevel: 'E0',
      acquisitionMode: 'unavailable', automatable: false, notes: 'Acesso HTTP falhando (Connection refused / WAF block) ou página offline.'
    },
    {
      id: crypto.randomUUID(), state: 'PR', institution: 'Polícia Civil / SESP-PR',
      sourceName: 'Estatísticas CAPE', officialPage: 'https://www.seguranca.pr.gov.br/Estatisticas', status: 'partially_available', evidenceLevel: 'E0',
      acquisitionMode: 'unavailable', automatable: false, notes: 'Portal migrado ou estrutura mudou. Não há links diretos de datasets (.csv, .xlsx, .zip) públicos via crawling simples.'
    },
    {
      id: crypto.randomUUID(), state: 'SC', institution: 'Secretaria de Segurança Pública de Santa Catarina (SSP-SC)',
      sourceName: 'Estatísticas Mensais SSP-SC', officialPage: 'https://ssp.sc.gov.br/transparencia/', status: 'partially_available', evidenceLevel: 'E0',
      acquisitionMode: 'unavailable', automatable: false, notes: 'Dados geralmente em relatórios BI ou PDFs. Sem links estruturados em endpoints diretos mapeados.'
    },
    {
      id: crypto.randomUUID(), state: 'DF', institution: 'Secretaria de Estado de Segurança Pública (SSP-DF)',
      sourceName: 'Estatísticas SSP-DF', officialPage: 'https://www.ssp.df.gov.br/estatisticas', status: 'partially_available', evidenceLevel: 'E0',
      acquisitionMode: 'unavailable', automatable: false, notes: 'Páginas respondem, mas os dados estão tipicamente em painéis do Power BI incorporados (iframes) e não em exportações cruas mapeáveis.'
    },
    {
      id: crypto.randomUUID(), state: 'PE', institution: 'Secretaria de Defesa Social (SDS-PE)',
      sourceName: 'Estatísticas SDS-PE', officialPage: 'https://www.sds.pe.gov.br/estatisticas', status: 'partially_available', evidenceLevel: 'E0',
      acquisitionMode: 'unavailable', automatable: false, notes: 'Não há links estruturados de datasets abertos no formato esperado (.csv, .xlsx, .zip).'
    },
    {
      id: crypto.randomUUID(), state: 'ES', institution: 'Secretaria de Estado da Segurança Pública e Defesa Social (SESP-ES)',
      sourceName: 'Estatísticas SESP-ES', officialPage: 'https://sesp.es.gov.br/observatorio-da-seguranca-publica', status: 'partially_available', evidenceLevel: 'E0',
      acquisitionMode: 'unavailable', automatable: false, notes: 'Uso forte de dashboards Power BI.'
    },
    {
      id: crypto.randomUUID(), state: 'GO', institution: 'Secretaria de Estado de Segurança Pública (SSP-GO)',
      sourceName: 'Estatísticas SSP-GO', officialPage: 'https://www.ssp.go.gov.br/estatisticas/', status: 'partially_available', evidenceLevel: 'E0',
      acquisitionMode: 'unavailable', automatable: false, notes: 'Página renderiza tabelas online ou dashboards.'
    },
    {
      id: crypto.randomUUID(), state: 'MT', institution: 'Secretaria de Estado de Segurança Pública (SESP-MT)',
      sourceName: 'Estatísticas SESP-MT', officialPage: 'https://www.sesp.mt.gov.br/estatisticas', status: 'partially_available', evidenceLevel: 'E0',
      acquisitionMode: 'unavailable', automatable: false, notes: 'Página retornou, mas não possui datasets brutos exportáveis na rota primária.'
    },
    {
      id: crypto.randomUUID(), state: 'MS', institution: 'Secretaria de Estado de Justiça e Segurança Pública (SEJUSP-MS)',
      sourceName: 'Estatísticas SEJUSP-MS', officialPage: 'https://www.sejusp.ms.gov.br/estatisticas', status: 'partially_available', evidenceLevel: 'E0',
      acquisitionMode: 'unavailable', automatable: false, notes: 'Idem.'
    }
  ];

  for (const s of sources) {
    try {
      await db.delete(sourceRegistry).where(eq(sourceRegistry.institution, s.institution));
      await db.insert(sourceRegistry).values({
        ...s,
        downloadMethod: 'GET',
        contentType: 'unknown',
        fileFormat: 'unknown',
        granularity: 'unknown',
        hasCoordinates: false,
        hasMunicipalityData: true,
        hasStateData: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`[Inserted] ${s.state} - ${s.sourceName} (${s.status})`);
    } catch (e) {
      console.error(e.message);
    }
  }
}
run();
