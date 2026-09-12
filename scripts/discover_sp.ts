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
  await checkUrl('ES (Observatorio)', 'https://sesp.es.gov.br/observatorio-da-seguranca-publica');
  await checkUrl('DF (Estatistica 2)', 'https://www.ssp.df.gov.br/painel-de-estatisticas/');
  await checkUrl('MG (Geo)', 'http://www.seguranca.mg.gov.br/2021-08-25-13-17-40/dados-abertos');
}
run();
