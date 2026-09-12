import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { db } from '../src/db/index.js';
import { geographicMunicipalities, securityOccurrences } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

async function run() {
  const geoNorm = new GeoNormalizationService();
  const m = await geoNorm.findNearestMunicipality(-22.9068, -43.1729, 60000);
  console.log('Resolved:', m);
  
  if (m) {
     const count = await db.execute(sql`
        SELECT COUNT(*) FROM ${securityOccurrences} 
        WHERE source_id = 'ISP-RJ' 
        AND municipality_name = ${m.code}
     `);
     console.log('Occurrences found matching code:', count);
  }
}
run();
