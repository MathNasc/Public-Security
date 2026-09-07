import fs from 'fs';
let code = fs.readFileSync('src/pages/Result.tsx', 'utf8');

// fix the string literal
code = code.replace(/\\\`text-2xl/g, '`text-2xl');
code = code.replace(/green-400\\'\\`/g, 'green-400\'`');
code = code.replace(/green-400\\'\\\\\\`/g, 'green-400\'`');
code = code.replace(/green-400'\\\`/g, "green-400'`");
code = code.replace(/green-400'\\`/g, "green-400'`");

fs.writeFileSync('src/pages/Result.tsx', code);
