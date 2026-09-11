const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const additionalSeeds = `
        { id: 'SSP-SC', name: 'Estatísticas Criminais SC', provider: 'SSP SC', coverage: 'SC', status: 'Ativo' },
        { id: 'SSP-BA', name: 'Indicadores Criminais BA', provider: 'SSP BA', coverage: 'BA', status: 'Ativo' },
        { id: 'SDS-PE', name: 'Estatísticas SDS', provider: 'SDS PE', coverage: 'PE', status: 'Ativo' },
        { id: 'SSPDS-CE', name: 'Indicadores SSPDS', provider: 'SSPDS CE', coverage: 'CE', status: 'Ativo' },
        { id: 'SSP-DF', name: 'Estatísticas DF', provider: 'SSP DF', coverage: 'DF', status: 'Ativo' },
        { id: 'SSP-GO', name: 'Ocorrências Criminais GO', provider: 'SSP GO', coverage: 'GO', status: 'Ativo' }
`;

code = code.replace(
  /\{ id: 'SSP-RS', name: 'Indicadores Criminais', provider: 'Secretaria de Segurança Pública RS', coverage: 'RS', status: 'Pendente' \}/,
  `{ id: 'SSP-RS', name: 'Indicadores Criminais', provider: 'Secretaria de Segurança Pública RS', coverage: 'RS', status: 'Ativo' },${additionalSeeds}`
);

// Atualiza também PR para 'Ativo' já que resolvemos na etapa anterior
code = code.replace(
  /\{ id: 'SESP-PR', name: 'Estatísticas SESP', provider: 'Secretaria de Segurança Pública PR', coverage: 'PR', status: 'Pendente' \}/,
  `{ id: 'SESP-PR', name: 'Estatísticas SESP', provider: 'Secretaria de Segurança Pública PR', coverage: 'PR', status: 'Ativo' }`
);

fs.writeFileSync('server.ts', code);
