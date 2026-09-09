import { SafetyAnalysisService } from './src/services/SafetyAnalysisService.js';

async function test() {
  try {
    const service = new SafetyAnalysisService();
    const res = await service.analyze({ lat: -23.5505, lon: -46.6333, radiusMeters: 1000, periodMonths: 12 });
    console.log("Success:", res);
  } catch (e: any) {
    console.error("Error:", e);
  }
  process.exit(0);
}
test();
