const fs = require('fs');
const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const result = await service.analyze({ lat: latitude, lon: longitude, radiusMeters, periodMonths });',
  'const result = await service.analyze({ lat: latitude, lon: longitude, radiusMeters, periodMonths, periodString: period as string });'
);
content = content.replace(
  'const cacheKey = `${latitude}_${longitude}_${radiusMeters}_${periodMonths}`;',
  'const cacheKey = `${latitude}_${longitude}_${radiusMeters}_${period}`;'
);


fs.writeFileSync(file, content);
