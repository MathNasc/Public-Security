async function checkUrl(state: string, url: string) {
  console.log(`\n=== Checking ${state} ===`);
  try {
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      } 
    });
    console.log(`Status: ${res.status}`);
    if (!res.ok) {
       console.log(`Failed to fetch. Status text: ${res.statusText}`);
       return;
    }
    const text = await res.text();
    const links = [...text.matchAll(/href=["']([^"']+)["']/g)].map(m => m[1]);
    const dataLinks = links.filter(l => l.includes('.csv') || l.includes('.xlsx') || l.includes('.xls') || l.includes('.zip') || l.includes('.rar'));
    const pdfLinks = links.filter(l => l.includes('.pdf'));
    
    console.log(`Found ${dataLinks.length} data links (CSV/XLSX/ZIP).`);
    if (dataLinks.length > 0) {
      console.log('Sample data links:', [...new Set(dataLinks)].slice(0, 10));
    }
    console.log(`Found ${pdfLinks.length} PDF links.`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

async function run() {
  await checkUrl('BA (SSP)', 'https://www.ba.gov.br/ssp/estatistica');
  await checkUrl('CE (SSPDS - url 1)', 'https://www.ce.gov.br/sspds/estatisticas/dados-detalhados/');
  await checkUrl('CE (SSPDS - url 2)', 'https://www.sspds.ce.gov.br/estatisticas-2/');
  await checkUrl('CE (Supesp)', 'https://www.supesp.ce.gov.br/estatisticas-2/');
}
run();
