import { db } from './src/db/index.js';
import { securityOccurrences } from './src/db/schema.js';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

async function main() {
  try {
     const values = [];
     for(let i =0; i < 500; i++){
       values.push({
          id: crypto.randomUUID(),
          sourceId: "Test",
          sourceRecordId: "T" + i,
          category: "Test",
          occurredAt: new Date(),
          latitude: 0,
          longitude: 0,
          locationPrecision: "exact",
          geocodingStatus: "original",
          originalAddress: "Test",
          createdAt: new Date(),
          updatedAt: new Date()
       });
     }
     await db.insert(securityOccurrences).values(values);
     console.log("Success");
  } catch (e: any) {
     console.error("Error length:", e.message.length);
     console.error("Error start:", e.message.substring(0, 300));
  }
  process.exit(0);
}
main();
