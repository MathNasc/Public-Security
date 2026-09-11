import { SinespAdapter } from './src/ingestion/adapters/sinesp/SinespAdapter.js';
import { db } from './src/db/index.js';
import { securityIndicators } from './src/db/schema.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Starting real SINESP download...");
  const adapter = new SinespAdapter();
  const tmpPath = path.join(process.cwd(), 'sinesp_download.csv');
  
  try {
    await adapter.download(tmpPath);
    console.log("Download completed. Parsing CSV...");

    // Delete existing national mock data so we don't duplicate
    console.log("Clearing previous SINESP mock data...");
    await db.execute(sql`DELETE FROM security_indicators WHERE source_id = 'SINESP'`);

    const records: any[] = [];
    const fileContent = fs.readFileSync(tmpPath, 'utf-8');
    const lines = fileContent.split('\n').filter(l => l.trim() !== '');
    
    // First line is headers
    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));

    console.log("Headers:", headers);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Simple split because usually no complex quotes in this dataset
      const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
      
      const row: any = {};
      headers.forEach((h, index) => {
        row[h] = values[index];
      });

      const parsed = adapter.parseRow(row);
      if (parsed && parsed.data) {
        records.push({
          id: crypto.randomUUID(),
          ...parsed.data,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    console.log(`Parsed ${records.length} valid records from CSV.`);

    // Insert in batches
    const BATCH_SIZE = 500;
    let inserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await db.insert(securityIndicators).values(batch).onConflictDoNothing();
      inserted += batch.length;
      if (inserted % 5000 === 0) console.log(`Inserted ${inserted} / ${records.length}`);
    }

    console.log("Successfully ingested real SINESP data!");
  } catch (error) {
    console.error("Failed to ingest real SINESP data:", error);
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}

main();
