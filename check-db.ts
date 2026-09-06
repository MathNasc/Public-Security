import { db } from './src/db/index.js';
import { securityIndicators } from './src/db/schema.js';

async function check() {
    const res = await db.select().from(securityIndicators);
    console.log("Indicators found:", res.length);
    console.log(res);
}
check();
