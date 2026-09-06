const fs = require('fs');

let searchBar = fs.readFileSync('src/components/SearchBar.tsx', 'utf-8');
searchBar = searchBar.replace(/suggestions\.map/g, "(suggestions || []).map");
fs.writeFileSync('src/components/SearchBar.tsx', searchBar);

let trendChart = fs.readFileSync('src/components/TrendChart.tsx', 'utf-8');
trendChart = trendChart.replace(/data\.map/g, "(data || []).map");
fs.writeFileSync('src/components/TrendChart.tsx', trendChart);

console.log("Patched components");
