import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

const importStatement = `import { analysisCache } from "./src/lib/cache.js";\n`;
if (!code.includes('analysisCache')) {
  code = importStatement + code;
}

const cacheLogic = `
  const cacheKey = \`\${latitude}_\${longitude}_\${radiusMeters}_\${periodMonths}\`;
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
`;

code = code.replace(
  'const service = new SafetyAnalysisService();',
  cacheLogic + '\n    const service = new SafetyAnalysisService();'
);

const setCacheLogic = `
    const responsePayload = {
      location: { latitude, longitude },
      radius: radiusMeters,
      period,
      score: {
        value: result.score !== null ? result.score : 0,
        classification: result.status === 'insufficient_data' ? "Dados insuficientes" : (result.score !== null && result.score < 40 ? "Alta atenção" : (result.score !== null && result.score < 75 ? "Atenção moderada" : "Baixa atenção")),
        confidence: result.confidence
      },
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
    };
    analysisCache.set(cacheKey, responsePayload);
    res.json(responsePayload);
`;

code = code.replace(/res\.json\(\{\s*location[\s\S]*?trend: \[\]\s*\}\);/m, setCacheLogic);

fs.writeFileSync('server.ts', code);
