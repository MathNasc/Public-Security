async function run() {
  const urls = [
    'https://www.sds.pe.gov.br/estatisticas',
    'https://www.sds.pe.gov.br/estatisticas-2',
    'https://www.sds.pe.gov.br/',
    'https://dados.pe.gov.br/'
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`${url}: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        const links = [...text.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
        const dataLinks = links.filter(l => l.includes('.csv') || l.includes('.xlsx') || l.includes('.xls') || l.includes('.zip'));
        console.log(`  Found ${dataLinks.length} data links.`);
      }
    } catch (e) {
      console.error(`${url}: Error: ${e.message}`);
    }
  }
}
run();
