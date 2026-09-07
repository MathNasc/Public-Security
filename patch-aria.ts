import fs from 'fs';
let code = fs.readFileSync('src/pages/Result.tsx', 'utf8');

code = code.replace(
  '<input\n      type="text"\n      value={query}',
  '<input\n      type="text"\n      aria-label="Pesquisar local"\n      value={query}'
);
fs.writeFileSync('src/pages/Result.tsx', code);

let codeHome = fs.readFileSync('src/components/SearchBar.tsx', 'utf8');
codeHome = codeHome.replace(
  '<input\n          type="text"\n          value={query}',
  '<input\n          type="text"\n          aria-label="Digite um endereço"\n          value={query}'
);
fs.writeFileSync('src/components/SearchBar.tsx', codeHome);
