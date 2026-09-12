async function run() {
  const urls = [
    'https://www.seguranca.pr.gov.br/Estatisticas',
    'https://www.pr.gov.br/transparencia',
    'https://www.ssp.sc.gov.br/index.php/estatisticas',
    'https://ssp.sc.gov.br/'
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
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
