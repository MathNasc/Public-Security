import { db } from '../src/db/index.js';
import { dataImports } from '../src/db/schema.js';
import { desc } from 'drizzle-orm';

async function run() {
  const jobs = await db.select().from(dataImports).orderBy(desc(dataImports.createdAt)).limit(5);
  for (const j of jobs) {
    console.log(`Job: ${j.id} | Source: ${j.sourceId} | Status: ${j.status} | File: ${j.originalFilename} | Hash: ${j.checksum}`);
  }
}
run();
