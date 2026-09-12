import { SafetyAnalysisService } from '../src/services/SafetyAnalysisService.js';

async function run() {
  const s = new SafetyAnalysisService();
  // Sao Paulo
  console.log("== SAO PAULO ==");
  const sp = await s.analyze({ lat: -23.5505, lon: -46.6333, radiusMeters: 5000, periodMonths: 48 });
  console.log(sp.fallback);
  console.log('SP Indicators:', sp.factors.length > 0 ? sp.factors : 'none');
  
  // Rio de Janeiro (Should trigger ISP-RJ logic)
  console.log("\n== RIO DE JANEIRO ==");
  const rj = await s.analyze({ lat: -22.9068, lon: -43.1729, radiusMeters: 5000, periodMonths: 48 });
  console.log(rj.fallback);
  console.log('RJ Indicators:', rj.availableData.totalRecords > 0 ? rj.availableData : 'none');
}
run();
