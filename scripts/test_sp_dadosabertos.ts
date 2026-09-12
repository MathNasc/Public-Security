async function run() {
  const url = 'https://dadosabertos.sp.gov.br/api/3/action/package_search?q=seguran%C3%A7a';
  const res = await fetch(url);
  console.log(`[${res.status}]`);
  const data = await res.json();
  console.log(data.result.results.map(r => r.title));
}
run();
