import { db } from '../src/db/index.js';
import { getPrimarySource } from '../src/ingestion/pipeline/SourcePriority.js';

async function run() {
  console.log("=== API LOGIC VALIDATION ===");
  console.log("Primary Source for SP:", getPrimarySource('SP'));
  console.log("Primary Source for RS:", getPrimarySource('RS'));
  console.log("Primary Source for CE:", getPrimarySource('CE'));
  console.log("Primary Source for BA:", getPrimarySource('BA'));
  console.log("Primary Source for RJ:", getPrimarySource('RJ'));
  console.log("Primary Source for unknown:", getPrimarySource('XX'));
  
  // Test an arbitrary region
  const res = await fetch('http://localhost:3000/api/analysis?lat=-23.5505&lon=-46.6333&radius=5000');
  const json = await res.json();
  console.log("\nAPI Output for SP:");
  console.log(`Score: ${json.score}`);
  console.log(`Source: ${json.source.name} (ID: ${json.source.id})`);
  console.log(`Granularity: ${json.granularity}`);
  console.log(`Fallback Used: ${json.fallback?.used}`);
  
  const resCe = await fetch('http://localhost:3000/api/analysis?lat=-3.7183&lon=-38.5434&radius=5000');
  const jsonCe = await resCe.json();
  console.log("\nAPI Output for Fortaleza (CE):");
  console.log(`Source: ${jsonCe.source.name} (ID: ${jsonCe.source.id})`);
  console.log(`Granularity: ${jsonCe.granularity}`);
  console.log(`Fallback Used: ${jsonCe.fallback?.used}`);
}
run();
