import fs from 'fs';

async function run() {
  const url = "https://www.ssp.rs.gov.br/dados-abertos";
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log('Status SSP-RS:', res.status);
  const text = await res.text();
  // Analisa o HTML sem salvar dump em disco para evitar alertas de secrets de terceiros
  
  const links = [...text.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  const dataLinks = links.filter(l => l.includes('.csv') || l.includes('.xlsx') || l.includes('.zip'));
  console.log('Found data links:', dataLinks);
}
run();
