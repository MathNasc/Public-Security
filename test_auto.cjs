require('dotenv').config();
const { AutoDownloader } = require('./dist/src/ingestion/orchestration/AutoDownloader.js');
AutoDownloader.triggerAll().then(console.log).catch(console.error);
