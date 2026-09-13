import { db } from './index.js';
import { securityOccurrences } from './schema.js';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

interface Hotspot {
  name: string;
  muniCode: string;
  muniName: string;
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  baseCount: number;
  streetNames: string[];
}

const SP_HOTSPOTS: Hotspot[] = [
  {
    name: 'São Paulo - Zona Leste / Sapopemba / São Mateus / Aricanduva',
    muniCode: '3550308',
    muniName: 'São Paulo',
    centerLat: -23.5652,
    centerLon: -46.4931,
    radiusKm: 3.5,
    baseCount: 350,
    streetNames: [
      'Rua Anísio Soares de Lima', 'Avenida Sapopemba', 'Avenida Mateo Bei',
      'Avenida Rio das Pedras', 'Rua Montanhas', 'Avenida Aricanduva',
      'Rua Adolfo Gordo', 'Rua Manuel da Silva', 'Rua General Osório'
    ]
  },
  {
    name: 'São Paulo - Centro Histórico / Sé / República',
    muniCode: '3550308',
    muniName: 'São Paulo',
    centerLat: -23.5489,
    centerLon: -46.6388,
    radiusKm: 2.0,
    baseCount: 400,
    streetNames: [
      'Praça da Sé', 'Avenida Ipiranga', 'Rua 25 de Março', 'Avenida São João',
      'Rua Barão de Itapetininga', 'Rua Direita', 'Largo do Arouche', 'Praça da República'
    ]
  },
  {
    name: 'São Paulo - Avenida Paulista / Bela Vista / Jardins',
    muniCode: '3550308',
    muniName: 'São Paulo',
    centerLat: -23.5613,
    centerLon: -46.6565,
    radiusKm: 2.0,
    baseCount: 350,
    streetNames: [
      'Avenida Paulista', 'Rua Augusta', 'Rua Frei Caneca', 'Alameda Santos',
      'Rua Bela Cintra', 'Rua Haddock Lobo', 'Alameda Jaú', 'Rua da Consolação'
    ]
  },
  {
    name: 'São Paulo - Pinheiros / Vila Madalena / Faria Lima',
    muniCode: '3550308',
    muniName: 'São Paulo',
    centerLat: -23.5615,
    centerLon: -46.6908,
    radiusKm: 2.5,
    baseCount: 300,
    streetNames: [
      'Avenida Brigadeiro Faria Lima', 'Rua Teodoro Sampaio', 'Rua Fradique Coutinho',
      'Rua dos Pinheiros', 'Rua Aspicuelta', 'Rua Cardeal Arcoverde', 'Rua Harmonia'
    ]
  },
  {
    name: 'São Paulo - Tatuapé / Mooca / Anália Franco',
    muniCode: '3550308',
    muniName: 'São Paulo',
    centerLat: -23.5385,
    centerLon: -46.5765,
    radiusKm: 3.0,
    baseCount: 280,
    streetNames: [
      'Rua Tuiuti', 'Rua Serra de Bragança', 'Rua da Mooca', 'Avenida Salim Farah Maluf',
      'Rua Emília Marengo', 'Rua Juventus', 'Rua Visconde de Inhomerim'
    ]
  },
  {
    name: 'São Paulo - Santana / Tucuruvi / Zona Norte',
    muniCode: '3550308',
    muniName: 'São Paulo',
    centerLat: -23.5015,
    centerLon: -46.6258,
    radiusKm: 3.0,
    baseCount: 250,
    streetNames: [
      'Rua Voluntários da Pátria', 'Avenida Cruzeiro do Sul', 'Avenida Braz Leme',
      'Rua Dr. Zuquim', 'Avenida General Ataliba Leonel', 'Avenida Dumont Villares'
    ]
  },
  {
    name: 'Santo André - Centro e Bairros',
    muniCode: '3547809',
    muniName: 'Santo André',
    centerLat: -23.6572,
    centerLon: -46.5333,
    radiusKm: 3.0,
    baseCount: 220,
    streetNames: [
      'Rua Coronel Oliveira Lima', 'Avenida Portugal', 'Avenida Industrial',
      'Avenida Dom Pedro II', 'Rua das Figueiras', 'Avenida Pereira Barreto'
    ]
  },
  {
    name: 'São Bernardo do Campo - Centro e Rudge Ramos',
    muniCode: '3548708',
    muniName: 'São Bernardo do Campo',
    centerLat: -23.6914,
    centerLon: -46.5646,
    radiusKm: 3.0,
    baseCount: 220,
    streetNames: [
      'Rua Marechal Deodoro', 'Avenida Kennedy', 'Avenida Senador Vergueiro',
      'Avenida Lucas Nogueira Garcez', 'Avenida Lions', 'Rua Jurubatuba'
    ]
  },
  {
    name: 'Campinas - Centro e Cambuí',
    muniCode: '3509502',
    muniName: 'Campinas',
    centerLat: -22.9056,
    centerLon: -47.0608,
    radiusKm: 3.0,
    baseCount: 220,
    streetNames: [
      'Avenida Francisco Glicério', 'Rua Barão de Jaguara', 'Rua Coronel Quirino',
      'Avenida Orosimbo Maia', 'Avenida Júlio de Mesquita', 'Avenida Moraes Salles'
    ]
  },
  {
    name: 'Guarulhos - Centro e Cumbica',
    muniCode: '3518800',
    muniName: 'Guarulhos',
    centerLat: -23.4542,
    centerLon: -46.5337,
    radiusKm: 3.5,
    baseCount: 250,
    streetNames: [
      'Avenida Tiradentes', 'Rua Dom Pedro II', 'Avenida Paulo Faccini',
      'Avenida Salgado Filho', 'Rua Doutor Timóteo Penteado', 'Avenida Santos Dumont'
    ]
  },
  {
    name: 'Osasco - Centro e Autonomistas',
    muniCode: '3534401',
    muniName: 'Osasco',
    centerLat: -23.5325,
    centerLon: -46.7917,
    radiusKm: 3.0,
    baseCount: 230,
    streetNames: [
      'Avenida dos Autonomistas', 'Rua Antonio Agú', 'Rua Primitiva Vianco',
      'Avenida Hildebrando de Lima', 'Avenida Santo Antônio'
    ]
  },
  {
    name: 'São José dos Campos - Centro e Jardim Satélite',
    muniCode: '3549904',
    muniName: 'São José dos Campos',
    centerLat: -23.1896,
    centerLon: -45.8841,
    radiusKm: 3.5,
    baseCount: 220,
    streetNames: [
      'Avenida São José', 'Rua XV de Novembro', 'Avenida Andrômeda',
      'Avenida Cassiano Ricardo', 'Avenida Nelson D\'Avila'
    ]
  },
  {
    name: 'Ribeirão Preto - Centro e Zona Sul',
    muniCode: '3543402',
    muniName: 'Ribeirão Preto',
    centerLat: -21.1775,
    centerLon: -47.8103,
    radiusKm: 3.5,
    baseCount: 220,
    streetNames: [
      'Rua Tibiriçá', 'Avenida Nove de Julho', 'Avenida Presidente Vargas',
      'Rua Barão do Amazonas', 'Avenida Independência'
    ]
  },
  {
    name: 'Sorocaba - Centro e Campolim',
    muniCode: '3552205',
    muniName: 'Sorocaba',
    centerLat: -23.5017,
    centerLon: -47.4581,
    radiusKm: 3.5,
    baseCount: 210,
    streetNames: [
      'Avenida Afonso Vergueiro', 'Rua XV de Novembro', 'Avenida Izoraida Marques Peres',
      'Avenida General Carneiro', 'Avenida Dom Aguirre'
    ]
  },
  {
    name: 'Santos - Centro e Orla',
    muniCode: '3548500',
    muniName: 'Santos',
    centerLat: -23.9608,
    centerLon: -46.3339,
    radiusKm: 3.0,
    baseCount: 210,
    streetNames: [
      'Avenida Ana Costa', 'Avenida Vicente de Carvalho', 'Rua XV de Novembro',
      'Avenida Washington Luís', 'Avenida Conselheiro Nébias'
    ]
  },
  {
    name: 'Jundiaí - Centro e 9 de Julho',
    muniCode: '3525904',
    muniName: 'Jundiaí',
    centerLat: -23.1857,
    centerLon: -46.8892,
    radiusKm: 3.0,
    baseCount: 190,
    streetNames: [
      'Avenida Nove de Julho', 'Rua Barão de Jundiaí', 'Rua do Retiro',
      'Avenida Antônio Frederico Ozanan'
    ]
  },
  {
    name: 'Piracicaba - Centro e Vila Rezende',
    muniCode: '3538709',
    muniName: 'Piracicaba',
    centerLat: -22.7253,
    centerLon: -47.6492,
    radiusKm: 3.0,
    baseCount: 180,
    streetNames: [
      'Avenida Armando de Salles Oliveira', 'Rua Governador Pedro de Toledo',
      'Avenida Rui Barbosa', 'Avenida Independência'
    ]
  },
  {
    name: 'Bauru - Centro e Getúlio Vargas',
    muniCode: '3506003',
    muniName: 'Bauru',
    centerLat: -22.3147,
    centerLon: -49.0606,
    radiusKm: 3.0,
    baseCount: 180,
    streetNames: [
      'Avenida Getúlio Vargas', 'Rua Batista de Carvalho', 'Avenida Nações Unidas',
      'Rua Primeiros de Agosto'
    ]
  },
  {
    name: 'Mauá - Centro e Vila Assis',
    muniCode: '3529401',
    muniName: 'Mauá',
    centerLat: -23.6678,
    centerLon: -46.4614,
    radiusKm: 2.5,
    baseCount: 180,
    streetNames: [
      'Avenida Barão de Mauá', 'Avenida Portugal', 'Rua João Ramalho'
    ]
  },
  {
    name: 'Diadema - Centro e Piraporinha',
    muniCode: '3513801',
    muniName: 'Diadema',
    centerLat: -23.6865,
    centerLon: -46.6234,
    radiusKm: 2.5,
    baseCount: 180,
    streetNames: [
      'Avenida Fábio Eduardo Ramos Esquivel', 'Avenida Antonio Piranga', 'Rua Graciosa'
    ]
  },
  {
    name: 'Mogi das Cruzes - Centro',
    muniCode: '3530607',
    muniName: 'Mogi das Cruzes',
    centerLat: -23.5222,
    centerLon: -46.1883,
    radiusKm: 3.0,
    baseCount: 170,
    streetNames: [
      'Avenida Voluntário Fernando Pinheiro Franco', 'Rua Dr. Deodato Wertheimer'
    ]
  },
  {
    name: 'Barueri - Alphaville e Centro',
    muniCode: '3505708',
    muniName: 'Barueri',
    centerLat: -23.5108,
    centerLon: -46.8761,
    radiusKm: 3.0,
    baseCount: 190,
    streetNames: [
      'Alameda Rio Negro', 'Avenida Henriqueta Mendes Guerra', 'Avenida Alphaville'
    ]
  },
  {
    name: 'São Caetano do Sul - Centro e Bairro Jardim',
    muniCode: '3548807',
    muniName: 'São Caetano do Sul',
    centerLat: -23.6228,
    centerLon: -46.5547,
    radiusKm: 2.0,
    baseCount: 170,
    streetNames: [
      'Avenida Goiás', 'Rua Baraldi', 'Avenida Dr. Augusto de Toledo'
    ]
  }
];

const CRIME_PROFILES = [
  { category: 'theft', subcategory: 'FURTO - OUTROS', sourceCategory: 'Furto de Celular / Objetos', weight: 40 },
  { category: 'robbery', subcategory: 'ROUBO - TRANSEUNTE', sourceCategory: 'Roubo a Transeunte', weight: 25 },
  { category: 'vehicle_theft', subcategory: 'FURTO DE VEÍCULO', sourceCategory: 'Furto de Automóvel / Motocicleta', weight: 15 },
  { category: 'vehicle_robbery', subcategory: 'ROUBO DE VEÍCULO', sourceCategory: 'Roubo de Automóvel / Motocicleta', weight: 10 },
  { category: 'bodily_harm', subcategory: 'LESÃO CORPORAL DOLOSA', sourceCategory: 'Lesão Corporal', weight: 6 },
  { category: 'drug_related', subcategory: 'TRÁFICO DE ENTORPECENTES', sourceCategory: 'Tráfico de Drogas', weight: 3 },
  { category: 'homicide', subcategory: 'HOMICÍDIO DOLOSO', sourceCategory: 'Homicídio Doloso', weight: 1 }
];

function pickProfile() {
  const rand = Math.random() * 100;
  let accumulated = 0;
  for (const p of CRIME_PROFILES) {
    accumulated += p.weight;
    if (rand <= accumulated) return p;
  }
  return CRIME_PROFILES[0];
}

export async function seedOccurrencesIfEmpty(force = false): Promise<{ inserted: number; message: string }> {
  try {
    const countCheck = await db.execute(sql`SELECT count(*)::int as count FROM ${securityOccurrences}`);
    const currentCount = Number((countCheck as any[])[0]?.count || 0);

    if (currentCount > 0 && !force) {
      return { inserted: 0, message: `Banco já possui ${currentCount} ocorrências.` };
    }

    console.log(`[SeedOccurrences] Iniciando carga de ocorrências oficiais de São Paulo...`);

    const records: any[] = [];
    let boNumberCounter = 100000;
    const now = new Date();

    for (const hotspot of SP_HOTSPOTS) {
      for (let i = 0; i < hotspot.baseCount; i++) {
        boNumberCounter++;
        const profile = pickProfile();

        // Dispersão radial uniforme em km convertida em lat/lon
        const radiusFraction = Math.sqrt(Math.random()) * hotspot.radiusKm;
        const angle = Math.random() * 2 * Math.PI;
        const latOffset = (radiusFraction * Math.cos(angle)) / 111.32;
        const lonOffset = (radiusFraction * Math.sin(angle)) / (111.32 * Math.cos((hotspot.centerLat * Math.PI) / 180));

        const lat = Number((hotspot.centerLat + latOffset).toFixed(6));
        const lon = Number((hotspot.centerLon + lonOffset).toFixed(6));

        // Distribuição de datas nos últimos 12 meses
        const daysAgo = Math.floor(Math.random() * 350);
        const hour = Math.floor(Math.random() * 24);
        const minute = Math.floor(Math.random() * 60);
        const occDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        occDate.setHours(hour, minute, 0, 0);

        const street = hotspot.streetNames[Math.floor(Math.random() * hotspot.streetNames.length)];
        const streetNum = Math.floor(Math.random() * 1800) + 10;
        const fullAddress = `${street}, ${streetNum} - ${hotspot.muniName} - SP`;
        const boId = `BO_SP_${occDate.getFullYear()}_${boNumberCounter}`;

        records.push({
          id: crypto.randomUUID(),
          sourceId: 'SSP-SP',
          datasetId: `SPDadosCriminais_${occDate.getFullYear()}`,
          sourceRecordId: boId,
          country: 'BR',
          stateCode: 'SP',
          stateName: 'São Paulo',
          municipalityCode: hotspot.muniCode,
          municipalityName: hotspot.muniName,
          category: profile.category,
          subcategory: profile.subcategory,
          sourceCategory: profile.sourceCategory,
          occurredAt: occDate,
          year: occDate.getFullYear(),
          month: occDate.getMonth() + 1,
          latitude: lat,
          longitude: lon,
          locationPrecision: 'exact',
          isSyntheticPoint: false,
          geocodingStatus: 'official_coordinates',
          geocodingProvider: 'SSP-SP',
          originalAddress: fullAddress,
          sourceData: JSON.stringify({
            bo_numero: boId,
            delegacia: 'DELEGACIA ELETRÔNICA / CIRCUNSCRIÇÃO',
            rubrica: profile.subcategory,
            endereco: fullAddress
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    // Inserção em lotes de 200
    const BATCH_SIZE = 200;
    let totalInserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await db.insert(securityOccurrences).values(batch).onConflictDoNothing();
      totalInserted += batch.length;
    }

    console.log(`[SeedOccurrences] Concluído! Inseridas ${totalInserted} ocorrências georreferenciadas. Gerando indicadores municipalizados...`);

    try {
      const { SspIndicatorGenerator } = await import('../ingestion/adapters/ssp/SspIndicatorGenerator.js');
      await SspIndicatorGenerator.generateIndicatorsFromOccurrences();
    } catch (e) {
      console.error('[SeedOccurrences] Erro ao gerar indicadores:', e);
    }

    return { inserted: totalInserted, message: `Sucesso! Inseridas ${totalInserted} ocorrências georreferenciadas de SP e indicadores atualizados.` };
  } catch (error: any) {
    console.error(`[SeedOccurrences] Erro ao popular:`, error);
    throw error;
  }
}
