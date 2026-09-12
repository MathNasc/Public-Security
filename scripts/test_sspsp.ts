async function run() {
  const urls = [
    'https://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx',
    'https://www.ssp.sp.gov.br/transparencia/dados-abertos',
    'https://dadosabertos.sp.gov.br/'
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`[${res.status}] ${url}`);
      const text = await res.text();
      const csvLinks = [...text.matchAll(/href="([^"]+\.csv)"/gi)].map(m => m[1]);
      const xlsxLinks = [...text.matchAll(/href="([^"]+\.xlsx)"/gi)].map(m => m[1]);
      if (csvLinks.length) console.log('  CSV:', csvLinks.slice(0, 5));
      if (xlsxLinks.length) console.log('  XLSX:', xlsxLinks.slice(0, 5));
    } catch (err) {
      console.log(`[ERR] ${url} - ${err.message}`);
    }
  }
}
run();
