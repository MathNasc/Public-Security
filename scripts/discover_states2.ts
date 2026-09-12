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
  await checkUrl('PE (Estatísticas)', 'https://www.sds.pe.gov.br/estatisticas/');
  await checkUrl('GO (Estatísticas)', 'https://www.ssp.go.gov.br/estatisticas/');
  await checkUrl('PA (Estatísticas)', 'https://www.segup.pa.gov.br/estatistica-criminal');
  await checkUrl('MT (Estatísticas)', 'https://www.sesp.mt.gov.br/estatisticas');
  await checkUrl('MS (Estatísticas)', 'https://www.sejusp.ms.gov.br/estatisticas');
  await checkUrl('PR (Dados)', 'https://www.dados.pr.gov.br/');
}
run();
