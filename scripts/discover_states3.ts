async function checkUrl(state: string, url: string) {
  console.log(`\n=== Checking ${state} ===`);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    const links = [...text.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const dataLinks = links.filter(l => l.includes('.csv') || l.includes('.xlsx') || l.includes('.xls') || l.includes('.zip'));
    console.log(`Found ${dataLinks.length} data links.`);
    if (dataLinks.length > 0) {
      console.log('Sample links:', [...new Set(dataLinks)].slice(0, 10));
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

async function run() {
  await checkUrl('PR (Polícia Civil)', 'https://www.policiacivil.pr.gov.br/Estatisticas');
  await checkUrl('SC (SSP)', 'https://www.ssp.sc.gov.br/index.php/estatisticas/mensal-por-municipios');
  await checkUrl('BA (SSP)', 'https://www.ba.gov.br/ssp/estatistica');
  await checkUrl('CE (SSPDS)', 'https://www.sspds.ce.gov.br/estatisticas-2/');
}
run();
