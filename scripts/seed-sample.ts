import { importSspFile } from '../src/ingestion/ssp/importer.js';
import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  const SAMPLE_URL = "https://raw.githubusercontent.com/NESPEDUFV/repositorio_dados_sbcup/main/crimes_2019_somente_sp_com_bairro.csv";
  const tempPath = path.join(os.tmpdir(), `sample_${Date.now()}.csv`);
  
  console.log("Downloading...");
  const response = await axios({
    method: "get",
    url: SAMPLE_URL,
    responseType: "stream"
  });

  const writer = fs.createWriteStream(tempPath);
  response.data.pipe(writer);

  await new Promise<void>((resolve, reject) => {
    writer.on("finish", () => resolve());
    writer.on("error", reject);
  });
  console.log("Downloaded to", tempPath);

  try {
    const res = await importSspFile(tempPath);
    console.log("Result:", res);
  } catch (e: any) {
    console.error("Error:", e.message);
  }

  process.exit(0);
}
main();
