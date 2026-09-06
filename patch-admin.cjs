const fs = require('fs');
let code = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');

// Fix categories mapping
code = code.replace(/stats\.categories\.map/g, "(stats.categories || []).map");

// Fix recentBatches mapping
code = code.replace(/stats\.recentBatches\.map/g, "(stats.recentBatches || []).map");

// Fix sources mapping
code = code.replace(/sources\.map/g, "(sources || []).map");

fs.writeFileSync('src/pages/Admin.tsx', code);
console.log("Patched Admin.tsx");
