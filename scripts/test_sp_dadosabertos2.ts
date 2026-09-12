async function run() {
  const url = 'https://dadosabertos.sp.gov.br/api/3/action/package_search?q=title:"BASE DE DADOS DA SECRETARIA DA SEGURANÇA PÚBLICA"';
  const res = await fetch(url);
  const data = await res.json();
  const pkg = data.result.results[0];
  console.log('Package:', pkg.title);
  pkg.resources.forEach(r => {
     console.log(` - [${r.format}] ${r.name}: ${r.url}`);
  });
}
run();
