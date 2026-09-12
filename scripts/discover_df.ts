async function run() {
  const urls = [
    'https://www.ssp.df.gov.br/estatisticas',
    'https://dados.df.gov.br/dataset/?q=ssp'
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
