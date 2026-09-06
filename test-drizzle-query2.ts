import { db } from './src/db/index.js';
import { securityOccurrences } from './src/db/schema.js';
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

const testTable = sqliteTable("test_table", {
  sourceId: text("source_id").notNull(),
  sourceRecordId: text("source_record_id"),
});

console.log(testTable.sourceId.name);
console.log(testTable.sourceRecordId.name);
