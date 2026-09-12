async function run() {
  const url = 'https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/download/dnsp-base-de-dados/bancovde-2026.xlsx/@@download/file';
  console.log(`Downloading ${url}...`);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    console.log(`Status: ${res.status}`);
    const buf = await res.arrayBuffer();
    console.log(`Size: ${buf.byteLength} bytes`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}
run();
