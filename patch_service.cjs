const fs = require('fs');
const file = 'src/services/SafetyAnalysisService.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('periodMonths: number;', 'periodString?: string;\n  periodMonths?: number;');

content = content.replace(
  'const { radiusMeters, periodMonths } = req;\n    const endDate = new Date("2019-12-31T23:59:59Z");\n    const startDate = new Date("2019-12-31T23:59:59Z");\n    startDate.setMonth(startDate.getMonth() - periodMonths);',
  `const { radiusMeters, periodMonths = 12, periodString = "12m" } = req;
    const endDate = new Date("2019-12-31T23:59:59Z");
    const startDate = new Date("2019-12-31T23:59:59Z");
    
    let effectiveMonths = periodMonths;
    if (periodString === "1w") {
      startDate.setDate(startDate.getDate() - 7);
      effectiveMonths = 0.25;
    } else if (periodString === "1m") {
      startDate.setMonth(startDate.getMonth() - 1);
      effectiveMonths = 1;
    } else if (periodString === "3m") {
      startDate.setMonth(startDate.getMonth() - 3);
      effectiveMonths = 3;
    } else if (periodString === "6m") {
      startDate.setMonth(startDate.getMonth() - 6);
      effectiveMonths = 6;
    } else if (periodString === "all") {
      startDate.setFullYear(2010);
      effectiveMonths = 120;
    } else {
      startDate.setMonth(startDate.getMonth() - periodMonths);
    }`
);

content = content.replace(
  'prevStartDate.setMonth(prevStartDate.getMonth() - periodMonths);',
  'prevStartDate.setTime(prevStartDate.getTime() - (endDate.getTime() - startDate.getTime()));'
);

content = content.replace(/this\.computeScore\(indicators, granularity, radiusMeters, periodMonths/g, 'this.computeScore(indicators, granularity, radiusMeters, effectiveMonths');
content = content.replace(/this\.computeScore\(prevIndicators, granularity, radiusMeters, periodMonths/g, 'this.computeScore(prevIndicators, granularity, radiusMeters, effectiveMonths');


fs.writeFileSync(file, content);
