import { SspRsDownloader } from '../src/ingestion/downloaders/ssprs_downloader.js';
async function run() {
  const downloader = new SspRsDownloader();
  await downloader.run();
}
run();
