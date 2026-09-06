const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const importDashboard = `import { Dashboard } from "./pages/Dashboard";\n`;
if (!code.includes("import { Dashboard }")) {
  code = importDashboard + code;
}

const navLink = `
            <div className="flex items-center gap-6">
              <a href="/dashboard" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Dashboard Nacional</a>
              <a href="/admin/data-sources" className="text-sm font-medium text-slate-300 hover:text-amber-500 transition-colors">Admin</a>
            </div>
`;
code = code.replace(/<\/a>\s*<\/div>\s*<\/header>/, "</a>" + navLink + "</div></header>");

const route = `<Route path="/dashboard" element={<Dashboard />} />\n            <Route path="/admin/data-sources"`;
code = code.replace(/<Route path="\/admin\/data-sources"/, route);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx");
