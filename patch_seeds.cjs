const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const newSeedData = `
    const seedData = [
      { name: "Dados Abertos SP (SSP-SP)", type: "api", url: "https://www.dadosabertos.sp.gov.br", description: "Secretaria de Segurança Pública de São Paulo", stateId: states.find(s => s.uf === 'SP')?.id || 1, status: "active", updateFrequency: "monthly" },
      { name: "ISP Dados RJ", type: "api", url: "https://www.ispdados.rj.gov.br", description: "Instituto de Segurança Pública do Rio de Janeiro", stateId: states.find(s => s.uf === 'RJ')?.id || 2, status: "active", updateFrequency: "monthly" },
      { name: "Observatório SSP-RS", type: "html", url: "https://ssp.rs.gov.br/indicadores-criminais", description: "Secretaria de Segurança Pública do Rio Grande do Sul", stateId: states.find(s => s.uf === 'RS')?.id || 3, status: "active", updateFrequency: "monthly" },
      { name: "Observatório SESP-ES", type: "html", url: "https://sesp.es.gov.br/Estatistica", description: "Secretaria de Estado da Segurança Pública do Espírito Santo", stateId: states.find(s => s.uf === 'ES')?.id || 4, status: "active", updateFrequency: "monthly" },
      { name: "SINESP (Nacional)", type: "api", url: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/sinesp-1/dados-abertos", description: "Sistema Nacional de Informações de Segurança Pública", status: "active", updateFrequency: "monthly" }
    ];
`;

serverCode = serverCode.replace(
  /const seedData = \[[\s\S]*?\];/,
  newSeedData.trim()
);

fs.writeFileSync('server.ts', serverCode);
