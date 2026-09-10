import { SafetyAnalysisService } from './src/services/SafetyAnalysisService.js';
import { db } from './src/db/index.js';

async function test() {
  const service = new SafetyAnalysisService();
  try {
    const res = await service.analyze({ lat: -23.5186, lon: -46.5057, radiusMeters: 1000, periodMonths: 1 });
    console.log("SUCCESS:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("FAIL:", e);
  }
}
test();
