const fs = require('fs');
let content = fs.readFileSync('src/services/SafetyAnalysisService.ts', 'utf8');

const newMethod = `
  private async fetchExactOccurrences(lat: number, lon: number, radiusMeters: number, startDate: Date, endDate: Date, sourceId: string) {
    const results = await db.execute(sql\`
      SELECT category, ST_Y(geom::geometry) as latitude, ST_X(geom::geometry) as longitude, occurred_at
      FROM \${securityOccurrences}
      WHERE source_id = 'SSP-SP (sample_1788974125648.csv)'
        AND occurred_at >= \${startDate.toISOString()}
        AND occurred_at <= \${endDate.toISOString()}
        AND ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(\${lon}, \${lat}), 4326)::geography) <= \${radiusMeters}
      LIMIT 100
    \`);
    return (results as any[]).map(row => ({
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      category: normalizeLegacyCategoryFix(row.category),
      date: new Date(row.occurred_at).toISOString()
    }));
  }
`;

content = content.replace('private async aggregateOccurrences', newMethod + '\n  private async aggregateOccurrences');

// Add fetchExactOccurrences to analyze() method
content = content.replace(
  'const indicators = await this.aggregateOccurrences(lat, lon, radiusMeters, startDate, endDate, primarySourceId);',
  `const indicators = await this.aggregateOccurrences(lat, lon, radiusMeters, startDate, endDate, primarySourceId);
      const exactOccurrences = await this.fetchExactOccurrences(lat, lon, radiusMeters, startDate, endDate, primarySourceId);`
);

content = content.replace(
  'indicators,\n        trend:',
  'indicators,\n        exactOccurrences,\n        trend:'
);

fs.writeFileSync('src/services/SafetyAnalysisService.ts', content);
