import { db } from '../../src/db/index.js';
import { sourceRegistry } from '../../src/db/schema.js';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

async function run() {
  const sources = [
    {
      id: crypto.randomUUID(),
      state: 'BR',
      institution: 'Ministério da Justiça e Segurança Pública (MJSP)',
      sourceName: 'SINESP Ocorrências Criminais',
      officialPage: 'https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica',
      downloadMethod: 'GET',
      requiresAuth: true, // Requires bearer token for API
      requiresSession: false,
      contentType: 'text/csv',
      fileFormat: 'CSV/XLSX',
      granularity: 'municipality',
      hasCoordinates: false,
      hasMunicipalityData: true,
      hasStateData: true,
      acquisitionMode: 'manual_upload',
      automatable: false,
      status: 'blocked',
      evidenceLevel: 'E4', // Fixture exists, but full download is blocked
      notes: 'Download automatizado indisponível. Requer Bearer token/WAF. Arquivos reais precisam ser baixados manualmente.',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: crypto.randomUUID(),
      state: 'SP',
      institution: 'Secretaria de Segurança Pública de São Paulo (SSP-SP)',
      sourceName: 'Dados Mensais / Transparência',
      officialPage: 'https://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx',
      downloadMethod: 'POST',
      requiresAuth: false,
      requiresSession: true, // Needs ViewState/EventValidation
      requiresCaptcha: true,
      contentType: 'text/csv',
      fileFormat: 'CSV',
      granularity: 'coordinates',
      hasCoordinates: true,
      hasMunicipalityData: true,
      hasStateData: false,
      acquisitionMode: 'manual_upload',
      automatable: false,
      status: 'manual_only',
      evidenceLevel: 'E6', 
      notes: 'ASP.NET WebForms requer ViewState e CAPTCHA/recaptcha em algumas áreas. Apenas upload manual seguro.',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: crypto.randomUUID(),
      state: 'RS',
      institution: 'Secretaria de Segurança Pública do Rio Grande do Sul (SSP-RS)',
      sourceName: 'Dados Abertos SSP-RS',
      officialPage: 'https://www.ssp.rs.gov.br/dados-abertos',
      downloadUrl: 'https://www.ssp.rs.gov.br/dados-abertos',
      downloadMethod: 'GET',
      requiresAuth: false,
      requiresSession: false,
      requiresCaptcha: false,
      contentType: 'application/zip',
      fileFormat: 'ZIP (CSV)',
      granularity: 'municipality',
      hasCoordinates: false,
      hasMunicipalityData: true,
      hasStateData: true,
      acquisitionMode: 'automatic',
      automatable: true,
      status: 'verified',
      evidenceLevel: 'E5', 
      notes: 'Arquivos ZIP/CSV disponíveis publicamente por semestre/ano.',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: crypto.randomUUID(),
      state: 'BA',
      institution: 'Secretaria de Segurança Pública da Bahia (SSP-BA)',
      sourceName: 'Estatísticas SSP-BA',
      officialPage: 'https://www.ba.gov.br/ssp/estatistica',
      acquisitionMode: 'unavailable',
      automatable: false,
      status: 'partially_available',
      evidenceLevel: 'E0',
      notes: 'Geralmente arquivos em PDF ou tabelas HTML não estruturadas.',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: crypto.randomUUID(),
      state: 'CE',
      institution: 'Secretaria da Segurança Pública e Defesa Social (SSPDS-CE)',
      sourceName: 'Estatísticas SSPDS-CE',
      officialPage: 'https://www.ce.gov.br/sspds/estatisticas/',
      acquisitionMode: 'unavailable',
      automatable: false,
      status: 'partially_available',
      evidenceLevel: 'E0',
      notes: 'Página sem download estruturado de CSV/ZIP na url base informada.',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const s of sources) {
    // Upsert logic for simplicity (check if institution+state exists, delete and insert)
    await db.delete(sourceRegistry).where(eq(sourceRegistry.institution, s.institution));
    await db.insert(sourceRegistry).values(s);
    console.log(`[Inserted] ${s.state} - ${s.sourceName} (${s.status})`);
  }
}

run().catch(console.error);
