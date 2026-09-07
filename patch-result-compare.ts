import fs from 'fs';
let code = fs.readFileSync('src/pages/Result.tsx', 'utf8');

const anchorSearchForm = '<form onSubmit={handleSearch} className="relative flex items-center">';

code = code.replace(anchorSearchForm, `
<div className="flex gap-2">
  <form onSubmit={handleSearch} className="relative flex items-center flex-1">
    <Search className="absolute left-3 w-4 h-4 text-slate-500" />
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Pesquisar local ou comparar..."
      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-slate-200 placeholder:text-slate-500"
    />
  </form>
</div>
`);

// When selecting, if they want to compare, we need a toggle. Let's add a state `isComparing`
const importAnchor = 'import { useState';
code = code.replace('import { useEffect, useState } from "react";', 'import { useEffect, useState } from "react";\nimport { GitCompare } from "lucide-react";');

const stateAnchor = 'const [searchLoading, setSearchLoading] = useState(false);';
code = code.replace(stateAnchor, stateAnchor + '\n  const [isComparing, setIsComparing] = useState(false);');

const formReplacement = `
<div className="flex gap-2 w-full">
  <form onSubmit={handleSearch} className="relative flex items-center flex-1">
    <Search className="absolute left-3 w-4 h-4 text-slate-500" />
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={isComparing ? "Digite o segundo local para comparar..." : "Pesquisar outro local..."}
      className={cn("w-full bg-slate-900 border rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-slate-200 placeholder:text-slate-500", isComparing ? "border-amber-500/50" : "border-slate-700")}
    />
  </form>
  <button 
    onClick={() => setIsComparing(!isComparing)}
    className={cn("px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2", isComparing ? "bg-amber-500/10 border-amber-500/50 text-amber-500" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700")}
  >
    <GitCompare className="w-4 h-4" /> <span className="hidden sm:inline">Comparar</span>
  </button>
</div>
`;

code = code.replace(/<div className="flex gap-2">[\s\S]*?<\/div>/, formReplacement);

const handleSelectReplacement = `
  const handleSelect = (item: any) => {
    setSuggestions([]);
    setQuery("");
    if (isComparing) {
      navigate(\`/comparar?lat1=\${lat}&lon1=\${lon}&address1=\${encodeURIComponent(address)}&lat2=\${item.latitude}&lon2=\${item.longitude}&address2=\${encodeURIComponent(item.formattedAddress)}\`);
    } else {
      navigate(\`/resultado?lat=\${item.latitude}&lon=\${item.longitude}&address=\${encodeURIComponent(item.formattedAddress)}\`);
    }
  };
`;
code = code.replace(/const handleSelect = \(item: any\) => \{[\s\S]*?\};/, handleSelectReplacement);

fs.writeFileSync('src/pages/Result.tsx', code);
