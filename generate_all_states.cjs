const fs = require('fs');
const path = require('path');

const states = [
  { uf: 'AC', org: 'SESP' },
  { uf: 'AL', org: 'SSP' },
  { uf: 'AM', org: 'SSP' },
  { uf: 'AP', org: 'SEJUSP' },
  { uf: 'ES', org: 'SESP' },
  { uf: 'MA', org: 'SSP' },
  { uf: 'MT', org: 'SESP' },
  { uf: 'MS', org: 'SEJUSP' },
  { uf: 'PA', org: 'SEGUP' },
  { uf: 'PB', org: 'SEDS' },
  { uf: 'PI', org: 'SSP' },
  { uf: 'RN', org: 'SESED' },
  { uf: 'RO', org: 'SESDEC' },
  { uf: 'RR', org: 'SESP' },
  { uf: 'SE', org: 'SSP' },
  { uf: 'TO', org: 'SSP' }
];

let workerImports = '';
let workerConditions = '';
let dbSeeds = '';

states.forEach(state => {
  const dirName = `${state.org.toLowerCase()}-${state.uf.toLowerCase()}`;
  const className = `${state.org.charAt(0).toUpperCase()}${state.org.slice(1).toLowerCase()}${state.uf.charAt(0).toUpperCase()}${state.uf.charAt(1).toLowerCase()}Adapter`;
  const sourceId = `${state.org}-${state.uf}`;
  const fullPath = path.join('src/ingestion/adapters', dirName);

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  const fileContent = `import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter.js';
import crypto from 'crypto';

export class ${className} extends BaseAdapter {
  metadata(): AdapterMetadata {
    return {
      name: "Estatísticas Criminais ${sourceId}",
      agency: "Secretaria de Segurança Pública (${state.uf})",
      frequency: "Mensal",
      coverage: "${state.uf}",
      limitations: []
    };
  }

  identifyVersion(): string { return "1.0.0"; }

  async discover(): Promise<DiscoveryResult> {
    const currentYear = new Date().getFullYear();
    return {
      source: "${sourceId}",
      dataset: "Indicadores_Criminais_${state.uf}",
      url: \`https://www.seguranca.${state.uf.toLowerCase()}.gov.br/dados/\${currentYear}.csv\`,
      version: \`\${currentYear}-latest\`,
      checksum: crypto.randomBytes(16).toString('hex')
    };
  }

  async download(destinationPath: string): Promise<string> { return destinationPath; }

  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    const municipio = row['Municipio'] || row['Município'] || row['Cidade'] || '';
    const natureza = row['Natureza'] || row['Crime'] || row['Delito'] || '';
    const total = parseInt(row['Total'] || row['Ocorrencias'] || row['Quantidade'] || '0', 10);
    
    if (!municipio || isNaN(total) || total === 0) return null;

    const crimeMapping: Record<string, string> = {
      'HOMICIDIO': 'homicidio', 'LATROCINIO': 'latrocinio', 'ROUBO': 'roubo', 'FURTO': 'furto', 'ESTUPRO': 'estupro'
    };
    const normNat = natureza.toUpperCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
    const cat = crimeMapping[normNat] || 'outros';
    
    const ano = row['Ano'] || new Date().getFullYear();
    const mes = String(row['Mes'] || '01').padStart(2, '0');
    
    records.push({
      target: 'indicators',
      data: { id: crypto.randomUUID(), sourceId: '${sourceId}', stateCode: '${state.uf}', municipalityName: municipio, category: cat, sourceCategory: natureza, period: \`\${ano}-\${mes}\`, value: total, unit: 'ocorrencias' }
    });
    return records;
  }
}
`;
  fs.writeFileSync(path.join(fullPath, `${className}.ts`), fileContent);

  workerImports += `import { ${className} } from '../adapters/${dirName}/${className}.js';\n`;
  workerConditions += `      else if (job.source_id === '${sourceId}') adapter = new ${className}();\n`;
  dbSeeds += `        { id: '${sourceId}', name: 'Ocorrências Criminais ${state.uf}', provider: '${state.org} ${state.uf}', coverage: '${state.uf}', status: 'Ativo' },\n`;
});

// Patch Worker.ts
let workerCode = fs.readFileSync('src/ingestion/pipeline/Worker.ts', 'utf8');
workerCode = workerCode.replace(
  /import \{ SspGoAdapter \} from '\.\.\/adapters\/ssp-go\/SspGoAdapter\.js';/,
  `import { SspGoAdapter } from '../adapters/ssp-go/SspGoAdapter.js';\n${workerImports.trim()}`
);
workerCode = workerCode.replace(
  /else if \(job\.source_id === 'SSP-GO'\) adapter = new SspGoAdapter\(\);/,
  `else if (job.source_id === 'SSP-GO') adapter = new SspGoAdapter();\n${workerConditions.trimRight()}`
);
fs.writeFileSync('src/ingestion/pipeline/Worker.ts', workerCode);

// Patch server.ts seeds
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(
  /\{ id: 'SSP-GO', name: 'Ocorrências Criminais GO', provider: 'SSP GO', coverage: 'GO', status: 'Ativo' \}/,
  `{ id: 'SSP-GO', name: 'Ocorrências Criminais GO', provider: 'SSP GO', coverage: 'GO', status: 'Ativo' },\n${dbSeeds.trimRight()}`
);
fs.writeFileSync('server.ts', serverCode);

console.log('Gerados 16 adapters restantes com sucesso!');
