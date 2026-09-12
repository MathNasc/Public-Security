const fs = require('fs');
let sinesp = fs.readFileSync('src/ingestion/downloaders/sinesp_downloader.ts', 'utf8');
sinesp = sinesp.replace('for (const link of links) {', 'for (const link of links.slice(0,1)) {');
fs.writeFileSync('src/ingestion/downloaders/sinesp_downloader.ts', sinesp);

let ba = fs.readFileSync('src/ingestion/pipeline/BaCrawler.ts', 'utf8');
ba = ba.replace('for (const year of yearsToScrape) {', 'for (const year of yearsToScrape.slice(0,1)) {');
ba = ba.replace('for (const fileUrl of fileLinks) {', 'for (const fileUrl of fileLinks.slice(0,1)) {');
fs.writeFileSync('src/ingestion/pipeline/BaCrawler.ts', ba);
console.log("Patched limit in downloaders");
