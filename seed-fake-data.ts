import { db } from './src/db/index.js';
import { securityIndicators, securityOccurrences } from './src/db/schema.js';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';

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

const UF_WEIGHTS: Record<string, number> = {
  'SP': 5.0, 'MG': 2.5, 'RJ': 2.0, 'BA': 1.8, 'PR': 1.4, 'RS': 1.3, 'PE': 1.1, 'CE': 1.0,
  'PA': 0.9, 'SC': 0.8, 'MA': 0.8, 'GO': 0.8, 'AM': 0.5, 'ES': 0.5, 'PB': 0.5, 'RN': 0.4,
  'MT': 0.4, 'AL': 0.4, 'PI': 0.4, 'DF': 0.4, 'MS': 0.3, 'SE': 0.3, 'RO': 0.2, 'TO': 0.2,
  'AC': 0.1, 'AP': 0.1, 'RR': 0.08
};

const CITIES = [
  { name: 'São Paulo', state: 'SP', lat: -23.5505, lng: -46.6333, cepBase: 1000000 },
  { name: 'Rio de Janeiro', state: 'RJ', lat: -22.9068, lng: -43.1729, cepBase: 20000000 },
  { name: 'Belo Horizonte', state: 'MG', lat: -19.9167, lng: -43.9345, cepBase: 30000000 },
  { name: 'Salvador', state: 'BA', lat: -12.9714, lng: -38.5014, cepBase: 40000000 },
  { name: 'Curitiba', state: 'PR', lat: -25.4284, lng: -49.2733, cepBase: 80000000 },
  { name: 'Manaus', state: 'AM', lat: -3.1190, lng: -60.0217, cepBase: 69000000 },
  { name: 'Fortaleza', state: 'CE', lat: -3.7172, lng: -38.5433, cepBase: 60000000 },
  { name: 'Brasília', state: 'DF', lat: -15.7801, lng: -47.9292, cepBase: 70000000 },
  { name: 'Recife', state: 'PE', lat: -8.0476, lng: -34.8770, cepBase: 50000000 },
  { name: 'Porto Alegre', state: 'RS', lat: -30.0346, lng: -51.2177, cepBase: 90000000 },
  { name: 'Belém', state: 'PA', lat: -1.4550, lng: -48.5023, cepBase: 66000000 },
  { name: 'Goiânia', state: 'GO', lat: -16.6869, lng: -49.2648, cepBase: 74000000 },
  { name: 'Campinas', state: 'SP', lat: -22.9071, lng: -47.0632, cepBase: 13000000 },
  { name: 'Florianópolis', state: 'SC', lat: -27.5954, lng: -48.5480, cepBase: 88000000 },
];

async function seed() {
  console.log("Clearing old mock data...");
  await db.execute(sql`DELETE FROM security_indicators WHERE source_id = 'SINESP'`);
  await db.execute(sql`DELETE FROM security_occurrences WHERE source_id = 'SIMULADO'`);

  // 1. National Aggregate Data
  const indicators = [];
  for (const uf of UFS) {
    for (const period of PERIODS) {
      for (const crime of CRIMES) {
        const baseVal = Math.floor(Math.random() * (crime.max - crime.min + 1)) + crime.min;
        const weight = UF_WEIGHTS[uf] || 1.0;
        const occurrences = Math.floor(baseVal * weight);
        
        indicators.push({
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

  // 2. Regional Detailed Data (All CEPs concept)
  const occurrencesArr = [];
  const TOTAL_REGIONAL = 8000;
  
  for (let i = 0; i < TOTAL_REGIONAL; i++) {
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    // Add some random jitter to simulate different neighborhoods / CEPs
    const latOffset = (Math.random() - 0.5) * 0.2; 
    const lngOffset = (Math.random() - 0.5) * 0.2;
    
    // Generate a random valid-looking CEP format
    const cepNumber = String(city.cepBase + Math.floor(Math.random() * 999999)).padStart(8, '0');
    const formattedCep = `${cepNumber.slice(0,5)}-${cepNumber.slice(5)}`;
    
    const daysAgo = Math.floor(Math.random() * 365);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    
    const cat = CRIMES[Math.floor(Math.random() * CRIMES.length)].id;

    occurrencesArr.push({
      id: crypto.randomUUID(),
      sourceId: 'SIMULADO',
      datasetId: 'simulado_ceps',
      title: `Ocorrência - CEP ${formattedCep}`,
      description: 'Dado simulado para demonstração',
      category: cat,
      occurredAt: date,
      latitude: (city.lat + latOffset).toString(),
      longitude: (city.lng + lngOffset).toString(),
      city: city.name,
      state: city.state,
      zipCode: formattedCep,
      geocodingStatus: 'geocoded',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  console.log(`Inserting ${indicators.length} National Indicators...`);
  const BATCH_SIZE = 500;
  for (let i = 0; i < indicators.length; i += BATCH_SIZE) {
    const batch = indicators.slice(i, i + BATCH_SIZE);
    await db.insert(securityIndicators).values(batch).onConflictDoNothing();
  }

  console.log(`Inserting ${occurrencesArr.length} Regional Occurrences (Mapeamento CEPs)...`);
  for (let i = 0; i < occurrencesArr.length; i += BATCH_SIZE) {
    const batch = occurrencesArr.slice(i, i + BATCH_SIZE);
    await db.insert(securityOccurrences).values(batch).onConflictDoNothing();
  }

  console.log("Done! Both national and regional test data seeded.");
}

seed().catch(console.error);
