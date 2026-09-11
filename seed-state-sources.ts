import { db } from './src/db/index.js';
import { dataSources } from './src/db/schema.js';

const sources = [
  { id: 'sinesp-nacional', name: 'SINESP Nacional', provider: 'MJSP', status: 'Ativo', enabled: true, coverage: 'Nacional' },
  { id: 'ssp-ac', name: 'SEJUSP Acre', provider: 'Portal Estadual', status: 'Em Análise', enabled: false, coverage: 'AC' },
  { id: 'ssp-al', name: 'SSP Alagoas', provider: 'Pesquisar Datasets', status: 'Em Análise', enabled: false, coverage: 'AL' },
  { id: 'ssp-ap', name: 'SEJUSP Amapá', provider: 'Pouca oferta', status: 'Pendente', enabled: false, coverage: 'AP' },
  { id: 'ssp-am', name: 'SSP Amazonas', provider: 'Catálogo próprio', status: 'Ativo', enabled: true, coverage: 'AM' },
  { id: 'ssp-ba', name: 'SSP Bahia', provider: 'Portal Oficial', status: 'Ativo', enabled: true, coverage: 'BA' },
  { id: 'ssp-ce', name: 'SSPDS Ceará', provider: 'SUPESP', status: 'Ativo', enabled: true, coverage: 'CE' },
  { id: 'ssp-df', name: 'SSP Distrito Federal', provider: 'Catálogo Estruturado', status: 'Ativo', enabled: true, coverage: 'DF' },
  { id: 'ssp-es', name: 'SESP Espírito Santo', provider: 'Portal SESP API', status: 'Ativo', enabled: true, coverage: 'ES' },
  { id: 'ssp-go', name: 'SSP Goiás', provider: 'Portal CKAN', status: 'Em Análise', enabled: false, coverage: 'GO' },
  { id: 'ssp-ma', name: 'SSP Maranhão', provider: 'Investigar', status: 'Pendente', enabled: false, coverage: 'MA' },
  { id: 'ssp-mt', name: 'SESP Mato Grosso', provider: 'Portal Estruturado', status: 'Em Análise', enabled: false, coverage: 'MT' },
  { id: 'ssp-ms', name: 'SEJUSP Mato Grosso do Sul', provider: 'Portal CKAN', status: 'Em Análise', enabled: false, coverage: 'MS' },
  { id: 'ssp-mg', name: 'SEJUSP Minas Gerais', provider: 'Dados Abertos MG', status: 'Ativo', enabled: true, coverage: 'MG' },
  { id: 'ssp-pa', name: 'SEGUP Pará', provider: 'Transparência SEGUP', status: 'Ativo', enabled: true, coverage: 'PA' },
  { id: 'ssp-pb', name: 'SEDS Paraíba', provider: 'Investigar datasets', status: 'Em Análise', enabled: false, coverage: 'PB' },
  { id: 'ssp-pr', name: 'SESP Paraná', provider: 'Dados SESP', status: 'Em Análise', enabled: false, coverage: 'PR' },
  { id: 'ssp-pe', name: 'SDS Pernambuco', provider: 'Portal CKAN', status: 'Ativo', enabled: true, coverage: 'PE' },
  { id: 'ssp-pi', name: 'SSP Piauí', provider: 'DATASSP', status: 'Ativo', enabled: true, coverage: 'PI' },
  { id: 'ssp-rj', name: 'ISP Rio de Janeiro', provider: 'ISP Dados Abertos', status: 'Ativo', enabled: true, coverage: 'RJ' },
  { id: 'ssp-rn', name: 'SESED Rio Grande do Norte', provider: 'Transparência RN', status: 'Em Análise', enabled: false, coverage: 'RN' },
  { id: 'ssp-rs', name: 'SSP Rio Grande do Sul', provider: 'Dados Abertos SSP', status: 'Ativo', enabled: true, coverage: 'RS' },
  { id: 'ssp-ro', name: 'SESDEC Rondônia', provider: 'Mais dependente de LAI', status: 'Pendente', enabled: false, coverage: 'RO' },
  { id: 'ssp-rr', name: 'SESP Roraima', provider: 'Investigar', status: 'Pendente', enabled: false, coverage: 'RR' },
  { id: 'ssp-sc', name: 'SSP Santa Catarina', provider: 'Portal estadual', status: 'Em Análise', enabled: false, coverage: 'SC' },
  { id: 'ssp-sp', name: 'SSP São Paulo', provider: 'Portal de Dados Abertos', status: 'Ativo', enabled: true, coverage: 'SP' },
  { id: 'ssp-se', name: 'SSP Sergipe', provider: 'Portal de dados', status: 'Ativo', enabled: true, coverage: 'SE' },
  { id: 'ssp-to', name: 'SSP Tocantins', provider: 'Investigar', status: 'Pendente', enabled: false, coverage: 'TO' },
];

async function seed() {
  console.log("Upserting State Sources...");
  for (const src of sources) {
    await db.insert(dataSources).values({
      ...src,
      createdAt: new Date(),
      updatedAt: new Date()
    }).onConflictDoNothing();
  }
  console.log("State Sources seeded!");
}

seed().catch(console.error);
