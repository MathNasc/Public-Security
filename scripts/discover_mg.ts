async function run() {
  const url = 'https://www.seguranca.mg.gov.br/2021-08-25-13-17-40/dados-abertos';
  try {
    const res = await fetch(url, { headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    } });
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
run();
