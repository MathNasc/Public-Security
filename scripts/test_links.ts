async function checkUrl(url: string) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`[${res.status}] ${url} -> ${res.url}`);
    if (res.ok) {
        const text = await res.text();
        console.log(`   Length: ${text.length}`);
        // look for links to datasets
        const links = [...text.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
        const dataLinks = links.filter(l => l.includes('.csv') || l.includes('.xlsx') || l.includes('.zip') || l.toLowerCase().includes('download') || l.includes('dataset'));
        if (dataLinks.length > 0) {
           console.log(`   Found data links:`, dataLinks.slice(0, 10));
        }
    }
  } catch (err) {
    console.log(`[ERROR] ${url}: ${err.message}`);
  }
}

async function run() {
  const urls = [
    'https://dados.mj.gov.br/',
    'https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica',
    'https://www.gov.br/mj/pt-br/acesso-a-informacao/dados-abertos',
    'https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica',
    'https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/download'
  ];
  for (const u of urls) await checkUrl(u);
}

run();
