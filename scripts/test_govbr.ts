async function run() {
  const res = await fetch("https://dados.gov.br/api/publico/conjuntos-dados/buscar?q=sinesp", {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text.substring(0, 500));
}
run();
