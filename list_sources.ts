import { db } from './src/db/index.js';
import { dataSources } from './src/db/schema.js';

async function list() {
  const sources = await db.select().from(dataSources);
  console.log(sources.map(s => s.id));
  process.exit(0);
}
list().catch(console.error);
