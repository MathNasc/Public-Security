async function run() {
  const url = 'https://www.portal.ssp.sp.gov.br/estatistica/consultas';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Length: ${text.length}`);
    if (text.includes('VIEWSTATE')) {
      console.log('Contains VIEWSTATE - it is WebForms.');
    } else {
      console.log('No VIEWSTATE found.');
    }
    const links = [...text.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const dataLinks = links.filter(l => l.includes('.csv') || l.includes('.xlsx') || l.includes('.zip'));
    console.log(`Data links: ${dataLinks.length}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}
run();
