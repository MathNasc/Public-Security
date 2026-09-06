const fs = require('fs');
let code = fs.readFileSync('src/pages/Result.tsx', 'utf-8');

code = code.replace(/data\.occurrences\.map/g, "(data.occurrences || []).map");
code = code.replace(/data\.dataSources\.map/g, "(data.dataSources || []).map");
code = code.replace(/Object\.entries\(data\.statistics\.othersBreakdown\)/g, "Object.entries(data.statistics?.othersBreakdown || {})");
code = code.replace(/stats\.categories\.map/g, "(stats.categories || []).map");
code = code.replace(/stats\.recentBatches\.map/g, "(stats.recentBatches || []).map");
code = code.replace(/sources\.map/g, "(sources || []).map");

fs.writeFileSync('src/pages/Result.tsx', code);
console.log("Patched Result.tsx");
