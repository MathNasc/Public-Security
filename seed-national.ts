import { db } from './src/db/index.js';
import { securityIndicators } from './src/db/schema.js';
import crypto from 'crypto';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const CRIMES = [
  { id: 'homicidio_doloso', min: 5, max: 200 },
  { id: 'roubo_veiculo', min: 10, max: 2000 },
  { id: 'furto_veiculo', min: 20, max: 3000 },
  { id: 'roubo_carga', min: 0, max: 300 },
  { id: 'latrocinio', min: 0, max: 20 },
  { id: 'estupro', min: 5, max: 300 },
];

const PERIODS = [
  '2023-10', '2023-11', '2023-12',
  '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'
];

// Population multiplier rough estimate to make SP/RJ/MG have more crimes than RR/AP
const UF_WEIGHTS: Record<string, number> = {
  'SP': 5.0, 'MG': 2.5, 'RJ': 2.0, 'BA': 1.8, 'PR': 1.4, 'RS': 1.3, 'PE': 1.1, 'CE': 1.0,
  'PA': 0.9, 'SC': 0.8, 'MA': 0.8, 'GO': 0.8, 'AM': 0.5, 'ES': 0.5, 'PB': 0.5, 'RN': 0.4,
  'MT': 0.4, 'AL': 0.4, 'PI': 0.4, 'DF': 0.4, 'MS': 0.3, 'SE': 0.3, 'RO': 0.2, 'TO': 0.2,
  'AC': 0.1, 'AP': 0.1, 'RR': 0.08
};

async function seed() {
  const values = [];
  
  for (const uf of UFS) {
    for (const period of PERIODS) {
      for (const crime of CRIMES) {
        // Base value randomly generated between min and max
        const baseVal = Math.floor(Math.random() * (crime.max - crime.min + 1)) + crime.min;
        // Adjust by state population weight
        const weight = UF_WEIGHTS[uf] || 1.0;
        const occurrences = Math.floor(baseVal * weight);
        
        values.push({
          id: crypto.randomUUID(),
          sourceId: 'SINESP',
          datasetId: 'indicadores_municipais',
          stateCode: uf,
          municipalityCode: 'UNKNOWN',
          category: crime.id,
          subcategory: crime.id,
          period: period,
          value: occurrences,
          unit: 'occurrences',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }

  console.log(`Prepared ${values.length} records. Inserting...`);
  
  let inserted = 0;
  const BATCH_SIZE = 500;
  try {
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      await db.insert(securityIndicators).values(batch).onConflictDoNothing();
      inserted += batch.length;
      console.log(`Inserted ${inserted} / ${values.length}`);
    }
    console.log("Seeding complete! Brazil data populated.");
  } catch (e) {
    console.error("Error seeding national data:", e);
  }
}
seed();
