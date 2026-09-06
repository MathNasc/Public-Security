import { db } from './src/db/index.js';
import { securityOccurrences } from './src/db/schema.js';

console.log("sourceId name:", securityOccurrences.sourceId.name);
console.log("sourceRecordId name:", securityOccurrences.sourceRecordId.name);
