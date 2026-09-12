import { IspRjDownloader } from '../src/ingestion/downloaders/isprj_downloader.js';

async function run() {
  const downloader = new IspRjDownloader();
  await downloader.run();
}
run();
