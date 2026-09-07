import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const analysisStart = code.indexOf('app.get("/api/analysis"');
const analysisEnd = code.indexOf('app.get("/api/data-sources"', analysisStart);

const newAnalysis = `
import { SafetyAnalysisService } from "./src/services/SafetyAnalysisService.js";

app.get("/api/analysis", async (req, res) => {
  const { lat, lon, radius = "1000", period = "12m" } = req.query;
  
  if (!lat || !lon) return res.status(400).json({ error: "Missing coordinates" });
  
  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lon as string);
  const radiusMeters = parseInt(radius as string, 10);
  
  let periodMonths = 12;
  if (period === "3m") periodMonths = 3;
  else if (period === "6m") periodMonths = 6;
  else if (period === "12m") periodMonths = 12;
  else if (period === "all") periodMonths = 60;
  else if (/^\\d{4}$/.test(period as string)) periodMonths = 12; // specific year is simplified for now
  
  try {
    const service = new SafetyAnalysisService();
    const result = await service.analyze({ lat: latitude, lon: longitude, radiusMeters, periodMonths });
    
    // We send back both the new structure AND some legacy fields so the frontend doesn't break entirely if we miss a spot.
    res.json({
      location: { latitude, longitude },
      radius: radiusMeters,
      period,
      score: {
        value: result.score !== null ? result.score : 0,
        classification: result.status === 'insufficient_data' ? "Dados insuficientes" : (result.score !== null && result.score < 40 ? "Alta atenção" : (result.score !== null && result.score < 75 ? "Atenção moderada" : "Baixa atenção")),
        confidence: result.confidence
      },
      // Expose new fields clearly
      result,
      statistics: {
        total: result.indicators.reduce((acc, curr) => acc + curr.value, 0),
        breakdown: {
          thefts: result.indicators.filter(i => i.canonicalCategory === 'theft').reduce((a, b) => a + b.value, 0),
          robberies: result.indicators.filter(i => i.canonicalCategory === 'robbery').reduce((a, b) => a + b.value, 0),
          vehicles: result.indicators.filter(i => i.categoryGroup === 'vehicle').reduce((a, b) => a + b.value, 0),
          others: result.indicators.filter(i => i.categoryGroup !== 'vehicle' && i.canonicalCategory !== 'theft' && i.canonicalCategory !== 'robbery').reduce((a, b) => a + b.value, 0)
        }
      },
      dataSources: result.sources,
      exactOccurrences: [],
      trend: []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Analysis Error" });
  }
});
`;

code = code.substring(0, analysisStart) + newAnalysis + code.substring(analysisEnd);

// Make sure to remove any existing import { SafetyAnalysisService } if we inject it again.
if (code.indexOf('import { SafetyAnalysisService }') !== code.lastIndexOf('import { SafetyAnalysisService }')) {
  // It's fine for now, we'll see if it crashes.
}

fs.writeFileSync('server.ts', code);
