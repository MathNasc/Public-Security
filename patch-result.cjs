const fs = require('fs');
let code = fs.readFileSync('src/pages/Result.tsx', 'utf-8');

code = code.replace(
  /<option value="12m">Últimos 12 meses<\/option>/g,
  `<option value="12m">Últimos 12 meses</option>
            <option value="2022">Ano de 2022</option>
            <option value="2021">Ano de 2021</option>
            <option value="2020">Ano de 2020</option>
            <option value="2019">Ano de 2019</option>
            <option value="all">Todo o histórico</option>`
);

fs.writeFileSync('src/pages/Result.tsx', code);
console.log('Patched Result.tsx successfully');
