import { SafetyAnalysisService } from '../src/services/SafetyAnalysisService.js';

async function run() {
  const s = new SafetyAnalysisService();
  console.log("\n== RIO DE JANEIRO ==");
  const rj = await s.analyze({ lat: -22.9068, lon: -43.1729, radiusMeters: 5000, periodMonths: 48 });
  console.log('Result:', JSON.stringify(rj, null, 2));
}
run();
