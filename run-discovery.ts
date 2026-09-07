import { SinespAdapter } from './src/ingestion/adapters/sinesp/SinespAdapter.js';

async function main() {
  const adapter = new SinespAdapter();
  console.log("Metadata:", adapter.metadata());
  console.log("Discovery:", await adapter.discover());
  
  const sampleRow = { UF: 'SP', Município: 'São Paulo', 'Tipo Crime': 'Homicídio doloso', Ano: '2024', Mês: 'janeiro', Ocorrências: '45' };
  console.log("Parse Sample:", adapter.parseRow(sampleRow));
}
main();
