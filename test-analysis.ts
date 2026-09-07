import { SafetyAnalysisService } from './src/services/SafetyAnalysisService.js';
import { db } from './src/db/index.js';

async function run() {
  const service = new SafetyAnalysisService();
  try {
    const result = await service.analyze({ lat: -23.5505, lon: -46.6333, radiusMeters: 1000, periodMonths: 12 });
    console.log(result);
  } catch (err) {
    console.error("DEBUG:", err);
  }
}

run().then(() => process.exit(0));
