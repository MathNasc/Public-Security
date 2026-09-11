const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const regex = /const seedData = \[[\s\S]*?\];/;

const newSeedData = `const seedData = [
      { id: "sinesp", name: "SINESP (Nacional)", provider: "Ministério da Justiça", coverage: "Nacional", sourceType: "api", url: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/sinesp-1/dados-abertos", officialUrl: "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/sinesp-1/dados-abertos", description: "Sistema Nacional de Informações de Segurança Pública", state: "BR" },
      { id: "ssp-ac", name: "Dados Abertos AC", provider: "Governo do Acre", coverage: "AC", sourceType: "html", url: "https://dados.ac.gov.br/", officialUrl: "https://dados.ac.gov.br/", description: "Portal de Dados Abertos do Acre", state: "AC" },
      { id: "ssp-al", name: "Segurança AL", provider: "SSP-AL", coverage: "AL", sourceType: "html", url: "https://seguranca.al.gov.br/", officialUrl: "https://seguranca.al.gov.br/", description: "Secretaria de Segurança Pública de Alagoas", state: "AL" },
      { id: "ssp-ap", name: "Portal Digital AP", provider: "Governo do Amapá", coverage: "AP", sourceType: "html", url: "https://apdigital.portal.ap.gov.br/inicio", officialUrl: "https://apdigital.portal.ap.gov.br/inicio", description: "Portal de Serviços do Amapá", state: "AP" },
      { id: "ssp-am", name: "Dados Abertos SSP-AM", provider: "SSP-AM", coverage: "AM", sourceType: "html", url: "https://www.ssp.am.gov.br/acesso-a-informacao/dados-abertos", officialUrl: "https://www.ssp.am.gov.br/acesso-a-informacao/dados-abertos", description: "Secretaria de Segurança Pública do Amazonas", state: "AM" },
      { id: "ssp-ba", name: "Dados Abertos SSP-BA", provider: "SSP-BA", coverage: "BA", sourceType: "html", url: "https://www.ba.gov.br/ssp/dados-abertos", officialUrl: "https://www.ba.gov.br/ssp/dados-abertos", description: "Secretaria de Segurança Pública da Bahia", state: "BA" },
      { id: "ssp-ce", name: "SUPESP CE", provider: "SUPESP-CE", coverage: "CE", sourceType: "html", url: "https://www.ce.gov.br/supesp/", officialUrl: "https://www.ce.gov.br/supesp/", description: "Superintendência de Pesquisa e Estratégia de Segurança Pública", state: "CE" },
      { id: "ssp-df", name: "Dados Abertos DF", provider: "SSP-DF", coverage: "DF", sourceType: "html", url: "https://dados.df.gov.br/pt/catalogo-dados?theme=seguranca", officialUrl: "https://dados.df.gov.br/pt/catalogo-dados?theme=seguranca", description: "Portal de Dados Abertos do DF - Segurança", state: "DF" },
      { id: "ssp-es", name: "Dados Abertos SESP-ES", provider: "SESP-ES", coverage: "ES", sourceType: "html", url: "https://dados.es.gov.br/organization/sesp-secretaria-de-estado-da-seguranca-publica-e-defesa-social", officialUrl: "https://dados.es.gov.br/organization/sesp-secretaria-de-estado-da-seguranca-publica-e-defesa-social", description: "Secretaria de Estado da Segurança Pública do ES", state: "ES" },
      { id: "ssp-go", name: "Dados Abertos GO", provider: "Governo de Goiás", coverage: "GO", sourceType: "html", url: "https://dadosabertos.go.gov.br/", officialUrl: "https://dadosabertos.go.gov.br/", description: "Portal de Dados Abertos de Goiás", state: "GO" },
      { id: "ssp-ma", name: "SSP-MA", provider: "SSP-MA", coverage: "MA", sourceType: "html", url: "https://www.ssp.ma.gov.br/", officialUrl: "https://www.ssp.ma.gov.br/", description: "Secretaria de Segurança Pública do Maranhão", state: "MA" },
      { id: "ssp-mt", name: "Dados Abertos MT", provider: "Governo de MT", coverage: "MT", sourceType: "html", url: "https://dadosabertos.mt.gov.br/", officialUrl: "https://dadosabertos.mt.gov.br/", description: "Portal de Dados Abertos do MT", state: "MT" },
      { id: "ssp-ms", name: "Dados MS", provider: "Governo de MS", coverage: "MS", sourceType: "html", url: "https://www.dados.ms.gov.br/", officialUrl: "https://www.dados.ms.gov.br/", description: "Portal de Dados Abertos de MS", state: "MS" },
      { id: "ssp-mg", name: "Dados MG (SEJUSP)", provider: "SEJUSP-MG", coverage: "MG", sourceType: "html", url: "https://www.dados.mg.gov.br/dataset/?organization=secretaria-de-estado-de-justica-e-seguranca-publica-sejusp", officialUrl: "https://www.dados.mg.gov.br/dataset/?organization=secretaria-de-estado-de-justica-e-seguranca-publica-sejusp", description: "Secretaria de Estado de Justiça e Segurança Pública", state: "MG" },
      { id: "ssp-pa", name: "Transparência SEGUP-PA", provider: "SEGUP-PA", coverage: "PA", sourceType: "html", url: "https://sistemas.segup.pa.gov.br/transparencia/institucional/", officialUrl: "https://sistemas.segup.pa.gov.br/transparencia/institucional/", description: "Secretaria de Segurança Pública e Defesa Social do Pará", state: "PA" },
      { id: "ssp-pb", name: "Segurança PB", provider: "SESDS-PB", coverage: "PB", sourceType: "html", url: "https://paraiba.pb.gov.br/diretas/secretaria-da-seguranca-e-defesa-social", officialUrl: "https://paraiba.pb.gov.br/diretas/secretaria-da-seguranca-e-defesa-social", description: "Secretaria da Segurança e Defesa Social da Paraíba", state: "PB" },
      { id: "ssp-pr", name: "Segurança PR", provider: "SESP-PR", coverage: "PR", sourceType: "html", url: "https://www.seguranca.pr.gov.br/", officialUrl: "https://www.seguranca.pr.gov.br/", description: "Secretaria da Segurança Pública do Paraná", state: "PR" },
      { id: "ssp-pe", name: "Dados PE", provider: "Governo de PE", coverage: "PE", sourceType: "html", url: "https://dados.pe.gov.br/pt_BR/", officialUrl: "https://dados.pe.gov.br/pt_BR/", description: "Portal de Dados Abertos de PE", state: "PE" },
      { id: "ssp-pi", name: "Dados SSP-PI", provider: "SSP-PI", coverage: "PI", sourceType: "html", url: "https://dados.ssp.pi.gov.br/policia", officialUrl: "https://dados.ssp.pi.gov.br/policia", description: "Secretaria de Segurança Pública do Piauí", state: "PI" },
      { id: "isp-rj", name: "ISP Dados RJ", provider: "ISP-RJ", coverage: "RJ", sourceType: "api", url: "https://www.ispdados.rj.gov.br/", officialUrl: "https://www.ispdados.rj.gov.br/", description: "Instituto de Segurança Pública do Rio de Janeiro", state: "RJ" },
      { id: "ssp-rn", name: "Transparência RN", provider: "Governo do RN", coverage: "RN", sourceType: "html", url: "https://www.transparencia.rn.gov.br/", officialUrl: "https://www.transparencia.rn.gov.br/", description: "Portal de Transparência do RN", state: "RN" },
      { id: "ssp-rs", name: "Dados Abertos SSP-RS", provider: "SSP-RS", coverage: "RS", sourceType: "html", url: "https://ssp.rs.gov.br/dados-abertos", officialUrl: "https://ssp.rs.gov.br/dados-abertos", description: "Secretaria de Segurança Pública do RS", state: "RS" },
      { id: "ssp-ro", name: "Governo RO", provider: "Governo de RO", coverage: "RO", sourceType: "html", url: "https://www.ro.gov.br/", officialUrl: "https://www.ro.gov.br/", description: "Portal do Governo de Rondônia", state: "RO" },
      { id: "ssp-rr", name: "Portal RR", provider: "Governo de RR", coverage: "RR", sourceType: "html", url: "https://portal.rr.gov.br/", officialUrl: "https://portal.rr.gov.br/", description: "Portal do Governo de Roraima", state: "RR" },
      { id: "ssp-sc", name: "Dados SC", provider: "Governo de SC", coverage: "SC", sourceType: "html", url: "https://dados.sc.gov.br/", officialUrl: "https://dados.sc.gov.br/", description: "Portal de Dados Abertos de SC", state: "SC" },
      { id: "ssp-sp", name: "Dados Abertos SSP-SP", provider: "SSP-SP", coverage: "SP", sourceType: "html", url: "https://www.ssp.sp.gov.br/transparencia/dados-abertos", officialUrl: "https://www.ssp.sp.gov.br/transparencia/dados-abertos", description: "Secretaria de Segurança Pública de São Paulo", state: "SP" },
      { id: "ssp-se", name: "Dados Abertos SE", provider: "Governo de SE", coverage: "SE", sourceType: "html", url: "https://transparencia.se.gov.br/DadosAbertos", officialUrl: "https://transparencia.se.gov.br/DadosAbertos", description: "Portal de Transparência de SE", state: "SE" },
      { id: "ssp-to", name: "SSP-TO", provider: "SSP-TO", coverage: "TO", sourceType: "html", url: "https://www.to.gov.br/ssp/", officialUrl: "https://www.to.gov.br/ssp/", description: "Secretaria de Segurança Pública do Tocantins", state: "TO" }
    ];`;

serverCode = serverCode.replace(regex, newSeedData);

// Também mudar o gatilho de auto-wipe para resetar a tabela e incluir esses 28
serverCode = serverCode.replace(
  /if \(sources\.length > 0 && \(!sources\[0\]\.url \|\| !sources\[0\]\.provider \|\| !sources\[0\]\.coverage\)\) \{/,
  'if (sources.length < 28) {'
);

fs.writeFileSync('server.ts', serverCode);
