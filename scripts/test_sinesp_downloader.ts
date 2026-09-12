import { SinespDownloader } from '../src/ingestion/downloaders/sinesp_downloader.js';

async function run() {
  const downloader = new SinespDownloader();
  await downloader.run();
}
run();
