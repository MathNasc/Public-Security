import fs from 'fs';
let code = fs.readFileSync('src/services/SafetyAnalysisService.ts', 'utf8');

const analyzeMethodSignature = "async analyze(req: AnalysisRequest): Promise<AnalysisResult> {";
const analyzeBodyStart = code.indexOf(analyzeMethodSignature) + analyzeMethodSignature.length;

const analyzeReplacement = `
    const { lat, lon, radiusMeters, periodMonths } = req;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periodMonths);

    try {
      // 1. Find Municipality for the given coordinate
      const muniResult = await db.execute(sql\`
        SELECT state_code, code as ibge_code, name, population 
        FROM \${geographicMunicipalities} 
        WHERE ST_Contains(geom::geometry, ST_SetSRID(ST_MakePoint(\${lon}, \${lat}), 4326))
        LIMIT 1
      \`);
`;

code = code.replace(
  `    const { lat, lon, radiusMeters, periodMonths } = req;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periodMonths);

    // 1. Find Municipality for the given coordinate
    const muniResult = await db.execute(sql\`
      SELECT state_code, code as ibge_code, name, population 
      FROM \${geographicMunicipalities} 
      WHERE ST_Contains(geom::geometry, ST_SetSRID(ST_MakePoint(\${lon}, \${lat}), 4326))
      LIMIT 1
    \`);`,
  analyzeReplacement
);

// We need to find the end of the analyze method to insert the catch block.
// Or we can just use a regex/replace trick.
