import { db } from "./index.js";
import { dataSources, occurrences } from "./schema.js";
import { DataIngestionService, RawCrimeRecord } from "../services/DataIngestionService.js";

function generateRealisticSampleData(centerLat: number, centerLon: number, count: number): RawCrimeRecord[] {
  const categories = ["Roubo", "Furto", "Veículo", "Outros", "Roubo", "Furto", "Furto"];
  const subcategories: Record<string, string[]> = {
    "Roubo": ["Roubo a transeunte", "Roubo de celular", "Roubo a comércio"],
    "Furto": ["Furto de celular", "Furto a residência", "Furto de bolsa"],
    "Veículo": ["Roubo de veículo", "Furto de veículo"],
    "Outros": ["Lesão corporal", "Dano", "Ameaça"]
  };
  
  const records: RawCrimeRecord[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    // Generate within ~2.5km radius
    const r = (Math.random() * 2500) / 111300; 
    const theta = Math.random() * 2 * Math.PI;
    const lat = centerLat + r * Math.cos(theta);
    const lon = centerLon + r * Math.sin(theta);
    
    // Spread over last 12 months
    const date = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
    
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const subcat = subcategories[cat][Math.floor(Math.random() * subcategories[cat].length)];
    
    records.push({
      source_record_id: `SSP-SP-${now.getFullYear()}-${Math.floor(Math.random() * 1000000)}`,
      category: cat,
      subcategory: subcat,
      occurred_at: date.toISOString(),
      latitude: lat,
      longitude: lon,
      location_precision: Math.random() > 0.2 ? "exact" : "approximate"
    });
  }
  return records;
}

async function main() {
  console.log("Cleaning old occurrences to reseed...");
  await db.delete(occurrences);
  await db.delete(dataSources);

  console.log("Generating sample data mimicking SSP-SP structure...");
  // Av. Maria Coelho Aguiar, 250 center approx: -23.6493, -46.7350
  const records = generateRealisticSampleData(-23.6493, -46.7350, 450); 
  
  await DataIngestionService.ingestData("SSP-SP (Amostra)", records, {
    provider: "Secretaria de Segurança Pública - SP",
    description: "Amostra de dados estruturados seguindo o padrão SSP-SP para o MVP. Os dados originais requerem download manual (Excel).",
    url: "http://www.ssp.sp.gov.br/transparenciassp/",
    coverage: "Estado de São Paulo",
  });

  console.log("Seed complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed!", err);
  process.exit(1);
});
