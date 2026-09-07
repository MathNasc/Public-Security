import { SinespAdapter } from './src/ingestion/adapters/sinesp/SinespAdapter.js';
import { rawStorage } from './src/ingestion/pipeline/Storage.js';
import { JobManager } from './src/ingestion/pipeline/JobManager.js';
import { db } from './src/db/index.js';
import { dataImports } from './src/db/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function run() {
  const adapter = new SinespAdapter();
  
  console.log("Starting SINESP Discovery...");
  const discovery = await adapter.discover();
  
  // Check if we already processed this checksum
  const existing = await db.select().from(dataImports).where(eq(dataImports.checksum, discovery.checksum));
  
  if (existing.length > 0 && existing[0].status === 'COMPLETED') {
    console.log(`Dataset ${discovery.version} already processed (Checksum: ${discovery.checksum}). Ignoring.`);
    process.exit(0);
  }
  
  console.log(`New dataset found! Version: ${discovery.version}`);
  
  const tempPath = path.join(process.cwd(), 'uploads', `sinesp_temp_${Date.now()}.csv`);
  if (!fs.existsSync(path.join(process.cwd(), 'uploads'))) fs.mkdirSync(path.join(process.cwd(), 'uploads'));
  
  console.log("Downloading from MJSP...");
  await adapter.download(tempPath);
  
  console.log("Storing in Raw Storage...");
  const fileStream = fs.createReadStream(tempPath);
  const stored = await rawStorage.put(discovery.dataset, discovery.version, 'sinesp.csv', fileStream);
  
  fs.unlinkSync(tempPath);
  
  console.log("Creating Job...");
  const jobId = await JobManager.createJob({
    sourceId: discovery.source,
    datasetId: discovery.dataset,
    rawFilePath: stored.path,
    originalFilename: stored.metadata.filename,
    checksum: discovery.checksum, // using discovery checksum instead of storage to link versions easily
    fileSize: stored.metadata.size
  });
  
  console.log(`Job Created Successfully! Job ID: ${jobId}`);
  console.log("Worker will pick it up automatically.");
  
  process.exit(0);
}

run().catch(e => {
  console.error("SINESP Schedule failed:", e);
  process.exit(1);
});
