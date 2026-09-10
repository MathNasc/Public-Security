const fs = require('fs');
let content = fs.readFileSync('src/services/SafetyAnalysisService.ts', 'utf8');

content = content.replace('let indicators: IndicatorValue[] = [];', 'let indicators: IndicatorValue[] = [];\n    let exactOccurrences: any[] = [];');

content = content.replace(
  'indicators = await this.aggregateOccurrences(lat, lon, radiusMeters, startDate, endDate, primarySourceId);',
  'indicators = await this.aggregateOccurrences(lat, lon, radiusMeters, startDate, endDate, primarySourceId);\n        exactOccurrences = await this.fetchExactOccurrences(lat, lon, radiusMeters, startDate, endDate, primarySourceId);'
);

fs.writeFileSync('src/services/SafetyAnalysisService.ts', content);
