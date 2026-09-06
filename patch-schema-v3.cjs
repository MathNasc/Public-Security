const fs = require('fs');

let code = fs.readFileSync('src/db/schema.ts', 'utf-8');

const newTables = `
// ==============================================
// 4. GEOGRAPHIC LAYER (IBGE)
// ==============================================

export const geographicStates = sqliteTable("geographic_states", {
  code: text("code").primaryKey(), // IBGE code (2 digits)
  acronym: text("acronym").notNull().unique(), // UF (e.g. SP, RJ)
  name: text("name").notNull(),
  region: text("region"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
});

export const geographicMunicipalities = sqliteTable("geographic_municipalities", {
  code: text("code").primaryKey(), // IBGE code (7 digits)
  stateCode: text("state_code").notNull(), // Links to geographicStates.code
  stateAcronym: text("state_acronym").notNull(), // e.g. SP
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(), // no accents, lowercase for searching
  population: integer("population"), // From census/estimativas
  latitude: real("latitude"), // Centroid
  longitude: real("longitude"), // Centroid
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
}, (table) => ({
  stateIdx: index("muni_state_idx").on(table.stateAcronym),
  normNameIdx: index("muni_norm_name_idx").on(table.normalizedName),
}));
`;

if (!code.includes('geographicStates')) {
  fs.writeFileSync('src/db/schema.ts', code + '\n' + newTables);
  console.log('Appended geographic tables to schema.ts');
}
