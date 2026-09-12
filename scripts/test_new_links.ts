async function checkUrl(url: string, name: string) {
  console.log(`\n=== Checking ${name} ===`);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    const links = [...text.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const dataLinks = links.filter(l => l.includes('.csv') || l.includes('.xlsx') || l.includes('.zip'));
    console.log(`Found ${dataLinks.length} data links.`);
    if (dataLinks.length > 0) {
      console.log('Sample links:', dataLinks.slice(0, 10));
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

async function run() {
  await checkUrl('https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023', 'SINESP');
  await checkUrl('https://www.portal.ssp.sp.gov.br/estatistica/consultas', 'SSP-SP');
}
run();
