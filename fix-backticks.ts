import fs from 'fs';
let code = fs.readFileSync('src/pages/Result.tsx', 'utf8');

code = code.replace(
  '<div className={\\`text-2xl font-bold \\${data.result.trend.percentage > 0 ? \'text-red-400\' : \'text-green-400\'}\\`}>',
  '<div className={`text-2xl font-bold ${data.result.trend.percentage > 0 ? "text-red-400" : "text-green-400"}`}>'
);

fs.writeFileSync('src/pages/Result.tsx', code);
