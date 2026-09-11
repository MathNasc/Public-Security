const fs = require('fs');
let serverCode = fs.readFileSync('server.ts', 'utf8');

const regex = /await db\.insert\(dataSources\)\.values\(seedData\.map\(s => \(\{\s*\.\.\.s\s*\}\)\)\)\.onConflictDoNothing\(\);/g;

serverCode = serverCode.replace(regex, `await db.insert(dataSources).values(seedData.map(s => ({
        ...s,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'OPERATIONAL'
      }))).onConflictDoNothing();`);

fs.writeFileSync('server.ts', serverCode);
