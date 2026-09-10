import { SafetyAnalysisService } from './src/services/SafetyAnalysisService.js';
async function run() {
  const service = new SafetyAnalysisService();
  const req = {
    location: { latitude: -23.5186, longitude: -46.5057 },
    radiusMeters: 1000,
    periodMonths: 12,
    periodString: "1m"
  };
  const result = await service.analyze(req as any);
  console.log("Result Period:", result.period);
  process.exit(0);
}
run();
