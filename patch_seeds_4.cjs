const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

const regex = /if \(sources\.length > 0 && !sources\[0\]\.url\) \{[\s\S]*?sources = \[\];\s*\}/;

serverCode = serverCode.replace(regex, `if (sources.length > 0 && (!sources[0].url || !sources[0].provider || !sources[0].coverage)) {
       await db.delete(dataSources);
       sources = [];
    }`);

fs.writeFileSync('server.ts', serverCode);
