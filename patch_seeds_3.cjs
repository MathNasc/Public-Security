const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const regex = /const seedData = \[[\s\S]*?\];/;

const newSeedData = `const seedData = [
        { id: "ssp-sp", name: "Dados Abertos SP (SSP-SP)", provider: "SSP-SP", coverage: "SP", sourceType: "api", url: "https://www.dadosabertos.sp.gov.br", officialUrl: "https://www.dadosabertos.sp.gov.br", description: "Secretaria de Segurança Pública de São Paulo", state: "SP" },
        { id: "isp-rj", name: "ISP Dados RJ", provider: "ISP-RJ", coverage: "RJ", sourceType: "api", url: "https://www.ispdados.rj.gov.br", officialUrl: "https://www.ispdados.rj.gov.br", description: "Instituto de Segurança Pública do Rio de Janeiro", state: "RJ" },
        { id: "ssp-rs", name: "Observatório SSP-RS", provider: "SSP-RS", coverage: "RS", sourceType: "html", url: "https://ssp.rs.gov.br/indicadores-criminais", officialUrl: "https://ssp.rs.gov.br/indicadores-criminais", description: "Secretaria de Segurança Pública do Rio Grande do Sul", state: "RS" },
        { id: "sesp-es", name: "Observatório SESP-ES", provider: "SESP-ES", coverage: "ES", sourceType: "html", url: "https://sesp.es.gov.br/Estatistica", officialUrl: "https://sesp.es.gov.br/Estatistica", description: "Secretaria de Estado da Segurança Pública do Espírito Santo", state: "ES" },
        { id: "sinesp", name: "SINESP (Nacional)", provider: "Ministério da Justiça", coverage: "Nacional", sourceType: "api", url: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/sinesp-1/dados-abertos", officialUrl: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/sinesp-1/dados-abertos", description: "Sistema Nacional de Informações de Segurança Pública", state: "BR" }
      ];`;

serverCode = serverCode.replace(regex, newSeedData);

fs.writeFileSync('server.ts', serverCode);
