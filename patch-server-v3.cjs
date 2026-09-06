const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

// The error says "Cannot read properties of undefined (reading 'map')" which usually means
// an API is returning null or an object that is missing arrays like categories or recentBatches
// in the /api/admin/data-quality endpoint. Let's make sure it returns empty arrays safely.

code = code.replace(/res\.json\(\{\s*coverage:/g, "res.json({\\n      categories: categories || [],\\n      recentBatches: recentBatches || [],\\n      coverage:");

// Fix /api/data-sources returning null/undefined instead of []
code = code.replace(/res\.json\(sources\);/g, "res.json(sources || []);");

fs.writeFileSync('server.ts', code);
console.log("Patched API endpoints for safe arrays");
