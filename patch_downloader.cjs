const fs = require('fs');
let code = fs.readFileSync('src/ingestion/orchestration/AutoDownloader.ts', 'utf8');

// safely handle catch
code = code.replace(
  /} catch \(e\) {/g,
  '} catch (e: any) {'
);
fs.writeFileSync('src/ingestion/orchestration/AutoDownloader.ts', code);
