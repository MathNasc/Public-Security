const fs = require('fs');
let content = fs.readFileSync('src/services/SafetyAnalysisService.ts', 'utf8');

const newMethod = `
  private async fetchExactOccurrences(lat: number, lon: number, radiusMeters: number, startDate: Date, endDate: Date, sourceId: string) {
    const results = await db.execute(sql\`
      SELECT category, geom, occurred_at
      FROM \${securityOccurrences}
      WHERE source_id = \${sourceId}
        AND occurred_at >= \${startDate.toISOString()}
        AND occurred_at <= \${endDate.toISOString()}
        AND ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(\${lon}, \${lat}), 4326)::geography) <= \${radiusMeters}
      LIMIT 100
    \`);
    return (results as any[]).map(row => {
      // In PostGIS, geom is usually returned in GeoJSON or WKB if we don't format it. 
      // We can use ST_AsGeoJSON(geom) to get parsing easily.
      return { row };
    });
  }
`;
// Let's modify this to use ST_X and ST_Y
