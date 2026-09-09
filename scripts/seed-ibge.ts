import { db } from '../src/db/index.js';
import { geographicStates, geographicMunicipalities } from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import axios from 'axios';

async function syncIBGE() {
  console.log("Starting IBGE sync for SP...");
  // Sync States
  const statesRes = await axios.get("https://servicodados.ibge.gov.br/api/v3/malhas/estados/SP?formato=application/vnd.geo+json");
  const spGeo = statesRes.data.features[0].geometry;

  // Insert State
  const stateCode = '35'; // SP
  const existingState = await db.query.geographicStates.findFirst({ columns: { code: true }, where: eq(geographicStates.code, stateCode) });
  
  if (!existingState) {
     await db.execute(sql`
       INSERT INTO geographic_states (code, acronym, name, geom, created_at, updated_at) 
       VALUES (${stateCode}, 'SP', 'São Paulo', ST_GeomFromGeoJSON(${JSON.stringify(spGeo)}), NOW(), NOW())
     `);
     console.log("Inserted State SP");
  }

  // Sync Municipalities for SP
  console.log("Downloading municipalities of SP...");
  const munRes = await axios.get(`https://servicodados.ibge.gov.br/api/v3/malhas/estados/SP?formato=application/vnd.geo+json&intrarregiao=municipio`);

  const features = munRes.data.features;
  console.log(`Got ${features.length} municipalities. Inserting...`);
  
  const namesRes = await axios.get(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios`);
  const namesMap = new Map(namesRes.data.map((m: any) => [m.id.toString(), m.nome]));

  let count = 0;
  for (const feature of features) {
     const code = feature.properties.codarea;
     const name = namesMap.get(code) || code;
     const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
     
     const existingMun = await db.query.geographicMunicipalities.findFirst({ columns: { code: true }, where: eq(geographicMunicipalities.code, code) });
     
     if (!existingMun) {
        await db.execute(sql`
           INSERT INTO geographic_municipalities (state_code, state_acronym, code, name, normalized_name, geom, created_at, updated_at)
           VALUES (${stateCode}, 'SP', ${code}, ${name}, ${normalized}, ST_GeomFromGeoJSON(${JSON.stringify(feature.geometry)}), NOW(), NOW())
        `);
     } else {
        await db.execute(sql`
           UPDATE geographic_municipalities
           SET geom = ST_GeomFromGeoJSON(${JSON.stringify(feature.geometry)}),
               normalized_name = ${normalized}
           WHERE code = ${code}
        `);
     }
     count++;
     if (count % 100 === 0) console.log(`Processed ${count} municipalities...`);
  }
  
  console.log("IBGE Sync Complete!");
  process.exit(0);
}
syncIBGE();
