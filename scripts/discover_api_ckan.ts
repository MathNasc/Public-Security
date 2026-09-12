async function checkCkan(portal: string, url: string) {
  try {
    const res = await fetch(`${url}/api/3/action/package_search?q=seguranca OR crime OR violencia`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`\n=== CKAN ${portal} === Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`Found ${data.result.count} datasets.`);
      if (data.result.count > 0) {
        console.log('Sample:', data.result.results.slice(0, 2).map(r => r.title));
      }
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

async function run() {
  await checkCkan('PE', 'https://dados.pe.gov.br');
  await checkCkan('DF', 'https://dados.df.gov.br');
  await checkCkan('PR', 'https://www.dados.pr.gov.br');
  await checkCkan('GO', 'https://dados.go.gov.br');
}
run();
