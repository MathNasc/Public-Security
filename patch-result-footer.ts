import fs from 'fs';
let code = fs.readFileSync('src/pages/Result.tsx', 'utf8');

code = code.replace(
  '<span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Última leitura: {new Date(d.lastUpdatedAt || d.updatedAt || d.updated_at).toLocaleDateString(\'pt-BR\')}</span>',
  '<span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded" title="Baseada no pipeline de ingestão">Última leitura: {new Date(d.lastUpdatedAt || d.updatedAt || d.updated_at).toLocaleDateString(\'pt-BR\')}</span>'
);

fs.writeFileSync('src/pages/Result.tsx', code);
