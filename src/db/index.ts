import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { createClient as createLibsqlClient } from "@libsql/client";
import postgres from "postgres";
import * as schema from './schema.js';
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

let rawConn = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

// Verify if connection string is pointing to real remote Postgres or local/unreachable default
const isDefaultLocalPg = rawConn.includes("localhost:5432") || rawConn.includes("127.0.0.1:5432");
const isUnreachableSupabase = rawConn.includes("db.eykrzanfocirkbcbrbyp.supabase.co");
const isFileDb = rawConn.startsWith("file:");
const useLibsqlFallback = !rawConn || isDefaultLocalPg || isFileDb || isUnreachableSupabase;

let dbInstance: any;
let queryClientInstance: any;

if (useLibsqlFallback) {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'local_radar.db');
  console.log(`[Database] PostgreSQL não configurado ou offline. Utilizando banco local SQLite/LibSQL: ${dbPath}`);

  const libsqlClient = createLibsqlClient({ url: `file:${dbPath}` });
  libsqlClient.execute('PRAGMA journal_mode = WAL;').catch(() => {});
  libsqlClient.execute('PRAGMA busy_timeout = 30000;').catch(() => {});

  // Criação automática de tabelas essenciais no SQLite local
  libsqlClient.executeMultiple(`
    CREATE TABLE IF NOT EXISTS source_registry (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      institution TEXT NOT NULL,
      source_name TEXT NOT NULL,
      official_page TEXT,
      download_url TEXT,
      final_download_url TEXT,
      download_method TEXT,
      requires_auth INTEGER DEFAULT 0,
      requires_session INTEGER DEFAULT 0,
      requires_captcha INTEGER DEFAULT 0,
      content_type TEXT,
      file_format TEXT,
      coverage_start TEXT,
      coverage_end TEXT,
      granularity TEXT,
      has_coordinates INTEGER DEFAULT 0,
      has_municipality_data INTEGER DEFAULT 0,
      has_state_data INTEGER DEFAULT 0,
      periodicity TEXT,
      expected_columns TEXT,
      notes TEXT,
      status TEXT,
      last_successful_download_at TEXT,
      last_downloaded_hash TEXT,
      last_downloaded_size INTEGER,
      evidence_level TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT,
      country TEXT NOT NULL DEFAULT 'BR',
      state TEXT,
      source_type TEXT,
      official_url TEXT,
      documentation_url TEXT,
      description TEXT,
      url TEXT,
      update_frequency TEXT,
      enabled INTEGER DEFAULT 1,
      last_successful_import TEXT,
      last_attempt TEXT,
      status TEXT,
      records_imported INTEGER DEFAULT 0,
      coverage TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `).then(async () => {
    await libsqlClient.execute({
      sql: `INSERT OR IGNORE INTO data_sources (id, name, provider, country, state, source_type, enabled, status) 
            VALUES ('SSP-SP', 'Secretaria de Segurança Pública de São Paulo', 'SSP-SP', 'BR', 'SP', 'API', 1, 'OPERATIONAL')`,
      args: []
    });
    await libsqlClient.execute({
      sql: `INSERT OR REPLACE INTO data_sources (id, name, provider, country, state, source_type, enabled, status, description) 
            VALUES ('SINESP', 'Sistema Nacional de Informações de Segurança Pública', 'Ministério da Justiça e Segurança Pública (MJSP)', 'BR', 'BR', 'CSV', 1, 'BLOCKED', 'Download automatizado indisponível (dados.mj.gov.br descontinuado; API dados.gov.br requer Bearer token; WAF em gov.br). Requer upload manual de arquivos CSV/XLSX oficiais extraídos do portal.')`,
      args: []
    });
  }).catch(() => {});

  libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS data_datasets (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      format TEXT,
      geographic_level TEXT,
      period_start TEXT,
      period_end TEXT,
      last_modified TEXT,
      checksum TEXT,
      discovery_frequency TEXT NOT NULL DEFAULT 'monthly',
      expected_update_frequency TEXT NOT NULL DEFAULT 'monthly',
      enabled INTEGER NOT NULL DEFAULT 1,
      discovery_url TEXT,
      parser_version TEXT,
      last_discovered_at TEXT,
      last_version TEXT,
      status TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `).then(async () => {
    await libsqlClient.execute({
      sql: `INSERT OR IGNORE INTO data_datasets (id, source_id, name, format, geographic_level, enabled, status) 
            VALUES ('ocorrencias_criminais_sp', 'SSP-SP', 'Ocorrências Criminais Registradas - SP', 'CSV', 'neighborhood', 1, 'active')`,
      args: []
    });
    await libsqlClient.execute({
      sql: `INSERT OR IGNORE INTO data_datasets (id, source_id, name, format, geographic_level, enabled, status) 
            VALUES ('indicadores_municipais', 'SINESP', 'Indicadores Municipais de Segurança Pública', 'CSV', 'municipality', 1, 'active')`,
      args: []
    });
  }).catch(() => {});

  libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS data_imports (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      records_downloaded INTEGER,
      records_parsed INTEGER,
      records_rejected INTEGER,
      error_message TEXT,
      raw_file_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      checksum TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      started_at TEXT,
      finished_at TEXT,
      checkpoint TEXT,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      failed_at TEXT,
      worker_id TEXT,
      locked_at TEXT,
      records_read INTEGER DEFAULT 0,
      records_valid INTEGER DEFAULT 0,
      records_invalid INTEGER DEFAULT 0,
      records_inserted INTEGER DEFAULT 0,
      records_updated INTEGER DEFAULT 0,
      records_duplicate INTEGER DEFAULT 0,
      records_without_coordinates INTEGER DEFAULT 0,
      records_with_invalid_coordinates INTEGER DEFAULT 0,
      records_with_unknown_municipality INTEGER DEFAULT 0,
      state_code TEXT,
      period TEXT,
      acquisition_method TEXT DEFAULT 'MANUAL_UPLOAD',
      origin_url TEXT,
      source_type TEXT,
      environment TEXT,
      is_official_publication BOOLEAN,
      is_eligible_for_production_automation BOOLEAN,
      parser_used TEXT,
      parser_version TEXT,
      quality_status TEXT DEFAULT 'PENDING',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(() => {});

  const dataImportsAlterCols = [
    "ALTER TABLE data_imports ADD COLUMN state_code TEXT;",
    "ALTER TABLE data_imports ADD COLUMN period TEXT;",
    "ALTER TABLE data_imports ADD COLUMN acquisition_method TEXT DEFAULT 'MANUAL_UPLOAD';",
    "ALTER TABLE data_imports ADD COLUMN origin_url TEXT;",
    "ALTER TABLE data_imports ADD COLUMN parser_used TEXT;",
    "ALTER TABLE data_imports ADD COLUMN parser_version TEXT;",
    "ALTER TABLE data_imports ADD COLUMN quality_status TEXT DEFAULT 'PENDING';"
  ];
  for (const q of dataImportsAlterCols) {
    libsqlClient.execute(q).catch(() => {});
  }

  libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS security_occurrences (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      source_record_id TEXT,
      country TEXT NOT NULL DEFAULT 'BR',
      state_code TEXT NOT NULL,
      state_name TEXT,
      municipality_code TEXT,
      municipality_name TEXT,
      category TEXT NOT NULL,
      subcategory TEXT,
      source_category TEXT,
      occurred_at TEXT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      latitude REAL,
      longitude REAL,
      geom TEXT,
      location_precision TEXT DEFAULT 'exact',
      is_synthetic_point INTEGER DEFAULT 0,
      geocoding_status TEXT DEFAULT 'pending',
      geocoding_provider TEXT,
      geocoding_confidence REAL,
      geocoded_at TEXT,
      original_address TEXT,
      source_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_id, source_record_id)
    );
  `).then(async () => {
    try {
      const info = await libsqlClient.execute('PRAGMA table_info(security_occurrences)');
      const cols = new Set(info.rows.map((r: any) => r.name));
      if (!cols.has('is_synthetic_point')) {
        await libsqlClient.execute('ALTER TABLE security_occurrences ADD COLUMN is_synthetic_point INTEGER DEFAULT 0');
      }
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS occ_geo_idx ON security_occurrences(latitude, longitude)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS occ_state_idx ON security_occurrences(state_code)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS occ_city_idx ON security_occurrences(municipality_code)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS occ_period_idx ON security_occurrences(year, month)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS occ_cat_idx ON security_occurrences(category)');
    } catch {}
  }).catch(() => {});

  libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS security_indicators (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      state_code TEXT NOT NULL,
      municipality_code TEXT,
      category TEXT NOT NULL,
      subcategory TEXT,
      source_category TEXT,
      period TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'occurrences',
      population_reference INTEGER,
      granularity TEXT DEFAULT 'municipality',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_id, state_code, municipality_code, category, subcategory, period)
    );
  `).then(async () => {
    try {
      const info = await libsqlClient.execute('PRAGMA table_info(security_indicators)');
      const cols = new Set(info.rows.map((r: any) => r.name));
      if (!cols.has('granularity')) {
        await libsqlClient.execute("ALTER TABLE security_indicators ADD COLUMN granularity TEXT DEFAULT 'municipality'");
      }
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS ind_src_idx ON security_indicators(source_id)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS ind_state_idx ON security_indicators(state_code)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS ind_city_idx ON security_indicators(municipality_code)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS ind_period_idx ON security_indicators(period)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS ind_cat_idx ON security_indicators(category)');
    } catch {}
  }).catch(() => {});

  libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS geographic_states (
      code TEXT PRIMARY KEY,
      acronym TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      region TEXT,
      geom TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `).then(async () => {
    const statesData = [
      ['11', 'RO', 'Rondônia', 'Norte'],
      ['12', 'AC', 'Acre', 'Norte'],
      ['13', 'AM', 'Amazonas', 'Norte'],
      ['14', 'RR', 'Roraima', 'Norte'],
      ['15', 'PA', 'Pará', 'Norte'],
      ['16', 'AP', 'Amapá', 'Norte'],
      ['17', 'TO', 'Tocantins', 'Norte'],
      ['21', 'MA', 'Maranhão', 'Nordeste'],
      ['22', 'PI', 'Piauí', 'Nordeste'],
      ['23', 'CE', 'Ceará', 'Nordeste'],
      ['24', 'RN', 'Rio Grande do Norte', 'Nordeste'],
      ['25', 'PB', 'Paraíba', 'Nordeste'],
      ['26', 'PE', 'Pernambuco', 'Nordeste'],
      ['27', 'AL', 'Alagoas', 'Nordeste'],
      ['28', 'SE', 'Sergipe', 'Nordeste'],
      ['29', 'BA', 'Bahia', 'Nordeste'],
      ['31', 'MG', 'Minas Gerais', 'Sudeste'],
      ['32', 'ES', 'Espírito Santo', 'Sudeste'],
      ['33', 'RJ', 'Rio de Janeiro', 'Sudeste'],
      ['35', 'SP', 'São Paulo', 'Sudeste'],
      ['41', 'PR', 'Paraná', 'Sul'],
      ['42', 'SC', 'Santa Catarina', 'Sul'],
      ['43', 'RS', 'Rio Grande do Sul', 'Sul'],
      ['50', 'MS', 'Mato Grosso do Sul', 'Centro-Oeste'],
      ['51', 'MT', 'Mato Grosso', 'Centro-Oeste'],
      ['52', 'GO', 'Goiás', 'Centro-Oeste'],
      ['53', 'DF', 'Distrito Federal', 'Centro-Oeste']
    ];
    for (const s of statesData) {
      await libsqlClient.execute({
        sql: `INSERT OR REPLACE INTO geographic_states (code, acronym, name, region) VALUES (?, ?, ?, ?)`,
        args: s
      });
    }
  }).catch(() => {});

  libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS geographic_municipalities (
      code TEXT PRIMARY KEY,
      state_code TEXT NOT NULL,
      state_acronym TEXT NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      population INTEGER,
      latitude REAL,
      longitude REAL,
      geom TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `).then(async () => {
    // Garante migração de colunas caso a tabela já existisse com schema antigo
    try {
      const info = await libsqlClient.execute('PRAGMA table_info(geographic_municipalities)');
      const cols = new Set(info.rows.map((r: any) => r.name));
      if (!cols.has('state_code')) await libsqlClient.execute('ALTER TABLE geographic_municipalities ADD COLUMN state_code TEXT');
      if (!cols.has('population')) await libsqlClient.execute('ALTER TABLE geographic_municipalities ADD COLUMN population INTEGER');
      if (!cols.has('latitude')) await libsqlClient.execute('ALTER TABLE geographic_municipalities ADD COLUMN latitude REAL');
      if (!cols.has('longitude')) await libsqlClient.execute('ALTER TABLE geographic_municipalities ADD COLUMN longitude REAL');
      if (!cols.has('geom')) await libsqlClient.execute('ALTER TABLE geographic_municipalities ADD COLUMN geom TEXT');
      if (!cols.has('created_at')) await libsqlClient.execute('ALTER TABLE geographic_municipalities ADD COLUMN created_at TEXT');
      if (!cols.has('updated_at')) await libsqlClient.execute('ALTER TABLE geographic_municipalities ADD COLUMN updated_at TEXT');

      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS muni_state_idx ON geographic_municipalities(state_acronym)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS muni_state_code_idx ON geographic_municipalities(state_code)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS muni_norm_name_idx ON geographic_municipalities(normalized_name)');
      await libsqlClient.execute('CREATE INDEX IF NOT EXISTS muni_coords_idx ON geographic_municipalities(latitude, longitude)');
      await libsqlClient.execute('CREATE UNIQUE INDEX IF NOT EXISTS muni_state_norm_idx ON geographic_municipalities(state_acronym, normalized_name)');
    } catch {}

    // Seed completo com todas as 27 capitais do Brasil + principais municípios de SP
    const allMunis = [
      // 27 Capitais dos Estados Brasileiros
      ['1100205', '11', 'RO', 'Porto Velho', 'porto velho', 548952, -8.7619, -63.9039],
      ['1200401', '12', 'AC', 'Rio Branco', 'rio branco', 419231, -9.9753, -67.8105],
      ['1302603', '13', 'AM', 'Manaus', 'manaus', 2063547, -3.1190, -60.0217],
      ['1400100', '14', 'RR', 'Boa Vista', 'boa vista', 413486, 2.8235, -60.6758],
      ['1501402', '15', 'PA', 'Belém', 'belem', 1303389, -1.4558, -48.4902],
      ['1600303', '16', 'AP', 'Macapá', 'macapa', 442933, 0.0389, -51.0664],
      ['1721000', '17', 'TO', 'Palmas', 'palmas', 302692, -10.1844, -48.3336],
      ['2111300', '21', 'MA', 'São Luís', 'sao luis', 1037775, -2.5307, -44.3068],
      ['2211001', '22', 'PI', 'Teresina', 'teresina', 866300, -5.0920, -42.8038],
      ['2304400', '23', 'CE', 'Fortaleza', 'fortaleza', 2428678, -3.7319, -38.5267],
      ['2408102', '24', 'RN', 'Natal', 'natal', 751300, -5.7945, -35.2110],
      ['2507507', '25', 'PB', 'João Pessoa', 'joao pessoa', 833932, -7.1195, -34.8450],
      ['2611606', '26', 'PE', 'Recife', 'recife', 1488920, -8.0476, -34.8770],
      ['2704302', '27', 'AL', 'Maceió', 'maceio', 957916, -9.6658, -35.7353],
      ['2800308', '28', 'SE', 'Aracaju', 'aracaju', 602757, -10.9472, -37.0731],
      ['2927408', '29', 'BA', 'Salvador', 'salvador', 2418005, -12.9777, -38.5016],
      ['3106200', '31', 'MG', 'Belo Horizonte', 'belo horizonte', 2315560, -19.9208, -43.9378],
      ['3205309', '32', 'ES', 'Vitória', 'vitoria', 322869, -20.3155, -40.3128],
      ['3304557', '33', 'RJ', 'Rio de Janeiro', 'rio de janeiro', 6211423, -22.9068, -43.1729],
      ['3550308', '35', 'SP', 'São Paulo', 'sao paulo', 11451245, -23.5505, -46.6333],
      ['4106902', '41', 'PR', 'Curitiba', 'curitiba', 1773733, -25.4290, -49.2671],
      ['4205407', '42', 'SC', 'Florianópolis', 'florianopolis', 537213, -27.5954, -48.5480],
      ['4314902', '43', 'RS', 'Porto Alegre', 'porto alegre', 1332570, -30.0346, -51.2177],
      ['5002704', '50', 'MS', 'Campo Grande', 'campo grande', 897938, -20.4697, -54.6201],
      ['5103403', '51', 'MT', 'Cuiabá', 'cuiaba', 650912, -15.6014, -56.0979],
      ['5208707', '52', 'GO', 'Goiânia', 'goiania', 1437237, -16.6869, -49.2648],
      ['5300108', '53', 'DF', 'Brasília', 'brasilia', 2817068, -15.7942, -47.8822],

      // Principais Municípios do Estado do Pará
      ['1500800', '15', 'PA', 'Ananindeua', 'ananindeua', 478778, -1.3639, -48.3742],
      ['1506807', '15', 'PA', 'Santarém', 'santarem', 331937, -2.4431, -54.7083],
      ['1504208', '15', 'PA', 'Marabá', 'maraba', 266536, -5.3686, -49.1178],
      ['1505536', '15', 'PA', 'Parauapebas', 'parauapebas', 267359, -6.0675, -49.9042],
      ['1502400', '15', 'PA', 'Castanhal', 'castanhal', 192262, -1.2967, -47.9258],
      ['1500107', '15', 'PA', 'Abaetetuba', 'abaetetuba', 158188, -1.7219, -48.8839],
      ['1502103', '15', 'PA', 'Cametá', 'cameta', 134108, -2.2444, -49.4958],
      ['1500602', '15', 'PA', 'Altamira', 'altamira', 126279, -3.2033, -52.2064],
      ['1501709', '15', 'PA', 'Bragança', 'braganca', 123082, -1.0536, -46.7656],
      ['1508126', '15', 'PA', 'Ulianópolis', 'ulianopolis', 43341, -3.7467, -47.4983],
      ['1508100', '15', 'PA', 'Tucuruí', 'tucurui', 91306, -3.7661, -49.6725],
      ['1503606', '15', 'PA', 'Itaituba', 'itaituba', 123314, -4.2761, -55.9836],
      ['1501303', '15', 'PA', 'Barcarena', 'barcarena', 126686, -1.5058, -48.6258],
      ['1505502', '15', 'PA', 'Paragominas', 'paragominas', 113145, -2.9986, -47.3536],
      ['1506138', '15', 'PA', 'Redenção', 'redencao', 85597, -8.0267, -50.0319],
      ['1507300', '15', 'PA', 'São Félix do Xingu', 'sao felix do xingu', 65412, -6.6447, -51.9950],
      ['1507953', '15', 'PA', 'Tailândia', 'tailandia', 79299, -2.9458, -48.9536],
      ['1507003', '15', 'PA', 'Santa Izabel do Pará', 'santa izabel do para', 73019, -1.2969, -48.1606],

      // Principais Municípios do Estado do Amazonas
      ['1303403', '13', 'AM', 'Parintins', 'parintins', 115352, -2.6289, -56.7358],
      ['1301902', '13', 'AM', 'Itacoatiara', 'itacoatiara', 103598, -3.1431, -58.4442],
      ['1302504', '13', 'AM', 'Manacapuru', 'manacapuru', 101883, -3.2997, -60.6206],
      ['1301209', '13', 'AM', 'Coari', 'coari', 85910, -4.0850, -63.1414],
      ['1304062', '13', 'AM', 'Tabatinga', 'tabatinga', 66764, -4.2322, -69.9381],
      ['1304203', '13', 'AM', 'Tefé', 'tefe', 63820, -3.3547, -64.7114],
      ['1302900', '13', 'AM', 'Maués', 'maues', 65158, -3.3836, -57.7186],
      ['1302108', '13', 'AM', 'Iranduba', 'iranduba', 60993, -3.2842, -60.1864],
      ['1303809', '13', 'AM', 'São Gabriel da Cachoeira', 'sao gabriel da cachoeira', 51795, -0.1303, -67.0892],
      ['1300607', '13', 'AM', 'Benjamin Constant', 'benjamin constant', 44873, -4.3831, -70.0311],
      ['1301704', '13', 'AM', 'Humaitá', 'humaita', 57473, -7.5061, -63.0306],
      ['1302405', '13', 'AM', 'Lábrea', 'labrea', 47003, -7.2594, -64.7981],
      ['1300201', '13', 'AM', 'Autazes', 'autazes', 40290, -3.5797, -59.1306],
      ['1303536', '13', 'AM', 'Presidente Figueiredo', 'presidente figueiredo', 37194, -2.0519, -60.0247],
      ['1301402', '13', 'AM', 'Careiro', 'careiro', 38348, -3.7681, -60.3694],
      ['1301605', '13', 'AM', 'Eirunepé', 'eirunepe', 35736, -6.6603, -69.8736],

      // Principais Municípios do Estado do Maranhão
      ['2105302', '21', 'MA', 'Imperatriz', 'imperatriz', 273110, -5.5264, -47.4917],
      ['2111201', '21', 'MA', 'São José de Ribamar', 'sao jose de ribamar', 244579, -2.5622, -44.0544],
      ['2112209', '21', 'MA', 'Timon', 'timon', 174465, -5.0939, -42.8364],
      ['2103000', '21', 'MA', 'Caxias', 'caxias', 156970, -4.8589, -43.3561],
      ['2107506', '21', 'MA', 'Paço do Lumiar', 'paco do lumiar', 145643, -2.5297, -44.1067],
      ['2103307', '21', 'MA', 'Codó', 'codo', 114269, -4.4553, -43.8856],
      ['2100055', '21', 'MA', 'Açailândia', 'acailandia', 106550, -4.9458, -47.5028],
      ['2101202', '21', 'MA', 'Bacabal', 'bacabal', 103711, -4.2408, -44.7836],
      ['2101400', '21', 'MA', 'Balsas', 'balsas', 101767, -7.5322, -46.0375],
      ['2109908', '21', 'MA', 'Santa Inês', 'santa ines', 85014, -3.6667, -45.3800],
      ['2101608', '21', 'MA', 'Barra do Corda', 'barra do corda', 84520, -5.5036, -45.2428],
      ['2108603', '21', 'MA', 'Pinheiro', 'pinheiro', 84621, -2.5214, -45.0828],
      ['2103208', '21', 'MA', 'Chapadinha', 'chapadinha', 81386, -3.7422, -43.3597],
      ['2110005', '21', 'MA', 'Santa Luzia', 'santa luzia', 67399, -4.0689, -45.6917],
      ['2102325', '21', 'MA', 'Buriticupu', 'buriticupu', 72983, -4.3486, -46.4022],
      ['2104800', '21', 'MA', 'Grajaú', 'grajau', 73872, -5.8192, -46.1389],
      ['2105401', '21', 'MA', 'Itapecuru Mirim', 'itapecuru mirim', 68686, -3.3936, -44.3589],
      ['2103604', '21', 'MA', 'Coroatá', 'coroata', 59566, -4.1308, -44.1239],

      // Principais Municípios do Estado da Paraíba
      ['2504009', '25', 'PB', 'Campina Grande', 'campina grande', 419379, -7.2219, -35.8811],
      ['2513703', '25', 'PB', 'Santa Rita', 'santa rita', 149910, -7.1139, -34.9781],
      ['2510808', '25', 'PB', 'Patos', 'patos', 108766, -7.0244, -37.2800],
      ['2501807', '25', 'PB', 'Bayeux', 'bayeux', 97010, -7.1250, -34.9322],
      ['2516201', '25', 'PB', 'Sousa', 'sousa', 67259, -6.7614, -38.2272],
      ['2503209', '25', 'PB', 'Cabedelo', 'cabedelo', 66519, -6.9811, -34.8339],
      ['2503704', '25', 'PB', 'Cajazeiras', 'cajazeiras', 63239, -6.8889, -38.5614],
      ['2506301', '25', 'PB', 'Guarabira', 'guarabira', 57484, -6.8550, -35.4900],
      ['2508901', '25', 'PB', 'Mamanguape', 'mamanguape', 44589, -6.8389, -35.1256],
      ['2512721', '25', 'PB', 'Queimadas', 'queimadas', 44177, -7.3589, -35.8989],
      ['2515302', '25', 'PB', 'São Bento', 'sao bento', 34431, -6.4839, -37.7500],
      ['2509701', '25', 'PB', 'Monteiro', 'monteiro', 32277, -7.8894, -37.1200],
      ['2506004', '25', 'PB', 'Esperança', 'esperanca', 31231, -7.0239, -35.8569],
      ['2511202', '25', 'PB', 'Pedras de Fogo', 'pedras de fogo', 29662, -7.4019, -35.1167],
      ['2504603', '25', 'PB', 'Conde', 'conde', 27605, -7.2597, -34.9075],
      ['2507309', '25', 'PB', 'Itabaiana', 'itabaiana', 23182, -7.3297, -35.3328],
      ['2512101', '25', 'PB', 'Pombal', 'pombal', 32443, -6.7719, -37.8019],
      ['2504900', '25', 'PB', 'Cuité', 'cuite', 19705, -6.4839, -36.1528],

      // Principais Municípios do Estado do Rio Grande do Norte
      ['2408003', '24', 'RN', 'Mossoró', 'mossoro', 264577, -5.1878, -37.3442],
      ['2403251', '24', 'RN', 'Parnamirim', 'parnamirim', 252716, -5.9156, -35.2628],
      ['2412005', '24', 'RN', 'São Gonçalo do Amarante', 'sao goncalo do amarante', 115838, -5.7928, -35.3272],
      ['2402600', '24', 'RN', 'Ceará-Mirim', 'ceara-mirim', 79115, -5.6339, -35.4256],
      ['2407104', '24', 'RN', 'Macaíba', 'macaiba', 82212, -5.8583, -35.3539],
      ['2402006', '24', 'RN', 'Caicó', 'caico', 61146, -6.4583, -37.0978],
      ['2400208', '24', 'RN', 'Açu', 'acu', 56496, -5.5764, -36.9100],
      ['2411502', '24', 'RN', 'São José de Mipibu', 'sao jose de mipibu', 47286, -6.0747, -35.2378],
      ['2403103', '24', 'RN', 'Currais Novos', 'currais novos', 41311, -6.2606, -36.5150],
      ['2413300', '24', 'RN', 'Santa Cruz', 'santa cruz', 37313, -6.2267, -36.0239],
      ['2408300', '24', 'RN', 'Nova Cruz', 'nova cruz', 34269, -6.4789, -35.4339],
      ['2401008', '24', 'RN', 'Apodi', 'apodi', 36093, -5.6644, -37.7989],
      ['2405801', '24', 'RN', 'João Câmara', 'joao camara', 33290, -5.5389, -35.8197],
      ['2414407', '24', 'RN', 'Touros', 'touros', 33089, -5.1989, -35.4608],
      ['2407500', '24', 'RN', 'Macau', 'macau', 27361, -5.1150, -36.6344],
      ['2409407', '24', 'RN', 'Pau dos Ferros', 'pau dos ferros', 30479, -6.1125, -38.2078],
      ['2403756', '24', 'RN', 'Extremoz', 'extremoz', 61571, -5.7061, -35.3067],
      ['2408201', '24', 'RN', 'Nísia Floresta', 'nisia floresta', 31942, -6.0911, -35.2089],

      // Principais Municípios do Estado de Alagoas
      ['2700300', '27', 'AL', 'Arapiraca', 'arapiraca', 234696, -9.7517, -36.6606],
      ['2707701', '27', 'AL', 'Rio Largo', 'rio largo', 93927, -9.4789, -35.8406],
      ['2706703', '27', 'AL', 'Palmeira dos Índios', 'palmeira dos indios', 71575, -9.4069, -36.6278],
      ['2709152', '27', 'AL', 'Teotônio Vilela', 'teotonio vilela', 38053, -9.9056, -36.3539],
      ['2708907', '27', 'AL', 'São Miguel dos Campos', 'sao miguel dos campos', 51990, -9.7811, -36.0939],
      ['2702306', '27', 'AL', 'Coruripe', 'coruripe', 50414, -10.1256, -36.1756],
      ['2702405', '27', 'AL', 'Delmiro Gouveia', 'delmiro gouveia', 51319, -9.3889, -37.9989],
      ['2704708', '27', 'AL', 'Marechal Deodoro', 'marechal deodoro', 60370, -9.7106, -35.8967],
      ['2708600', '27', 'AL', 'Santana do Ipanema', 'santana do ipanema', 46220, -9.3789, -37.2439],
      ['2709301', '27', 'AL', 'União dos Palmares', 'uniao dos palmares', 59280, -9.1628, -36.0319],
      ['2706901', '27', 'AL', 'Penedo', 'penedo', 58657, -10.2889, -36.5861],
      ['2708006', '27', 'AL', 'Pilar', 'pilar', 35211, -9.5969, -35.9578],
      ['2708808', '27', 'AL', 'São Luís do Quitunde', 'sao luis do quitunde', 30770, -9.3189, -35.5608],
      ['2708709', '27', 'AL', 'São José da Tapera', 'sao jose da tapera', 30650, -9.5589, -37.3819],
      ['2702207', '27', 'AL', 'Campo Alegre', 'campo alegre', 52106, -9.7828, -36.3508],
      ['2705200', '27', 'AL', 'Murici', 'murici', 28333, -9.3069, -35.9439],
      ['2700508', '27', 'AL', 'Atalaia', 'atalaia', 37512, -9.5019, -36.0228],
      ['2703007', '27', 'AL', 'Girau do Ponciano', 'girau do ponciano', 36100, -9.8839, -36.8339],

      // Principais Municípios do Estado de Sergipe
      ['2804805', '28', 'SE', 'Nossa Senhora do Socorro', 'nossa senhora do socorro', 192330, -10.8547, -37.1264],
      ['2803500', '28', 'SE', 'Lagarto', 'lagarto', 101579, -10.9169, -37.6500],
      ['2802908', '28', 'SE', 'Itabaiana', 'itabaiana', 103439, -10.6850, -37.4253],
      ['2806701', '28', 'SE', 'São Cristóvão', 'sao cristovao', 95554, -11.0147, -37.2064],
      ['2802106', '28', 'SE', 'Estância', 'estancia', 65078, -11.2683, -37.4383],
      ['2807402', '28', 'SE', 'Tobias Barreto', 'tobias barreto', 50905, -11.1839, -37.9989],
      ['2806008', '28', 'SE', 'Simão Dias', 'simao dias', 42578, -10.7389, -37.8106],
      ['2804904', '28', 'SE', 'Nossa Senhora da Glória', 'nossa senhora da gloria', 41212, -10.2189, -37.4206],
      ['2805307', '28', 'SE', 'Propriá', 'propria', 29690, -10.2119, -36.8419],
      ['2800605', '28', 'SE', 'Barra dos Coqueiros', 'barra dos coqueiros', 41511, -10.9069, -37.0378],
      ['2803005', '28', 'SE', 'Itabaianinha', 'itabaianinha', 40489, -11.2747, -37.7889],
      ['2805406', '28', 'SE', 'Poço Redondo', 'poco redondo', 33439, -9.8056, -37.6839],
      ['2801009', '28', 'SE', 'Campo do Brito', 'campo do brito', 18150, -10.7339, -37.4989],
      ['2801207', '28', 'SE', 'Capela', 'capela', 31620, -10.5039, -37.0539],
      ['2803609', '28', 'SE', 'Laranjeiras', 'laranjeiras', 29688, -10.8167, -37.1689],
      ['2804508', '28', 'SE', 'Neópolis', 'neopolis', 18340, -10.3208, -36.5778],
      ['2807600', '28', 'SE', 'Umbaúba', 'umbauba', 23918, -11.3839, -37.6569],

      // Principais Municípios do Estado do Piauí
      ['2211001', '22', 'PI', 'Teresina', 'teresina', 868319, -5.0892, -42.8019],
      ['2207702', '22', 'PI', 'Parnaíba', 'parnaiba', 162159, -2.9081, -41.7767],
      ['2208007', '22', 'PI', 'Picos', 'picos', 83090, -7.0769, -41.4669],
      ['2208403', '22', 'PI', 'Piripiri', 'piripiri', 65564, -4.2739, -41.7769],
      ['2203909', '22', 'PI', 'Floriano', 'floriano', 62054, -6.7669, -43.0219],
      ['2202208', '22', 'PI', 'Campo Maior', 'campo maior', 45793, -4.8278, -42.1686],
      ['2201200', '22', 'PI', 'Barras', 'barras', 47937, -4.2469, -42.2969],
      ['2211100', '22', 'PI', 'União', 'uniao', 44574, -4.5856, -42.8619],
      ['2200400', '22', 'PI', 'Altos', 'altos', 47453, -5.0389, -42.4600],
      ['2203701', '22', 'PI', 'Esperantina', 'esperantina', 40970, -3.8989, -42.2369],
      ['2205508', '22', 'PI', 'José de Freitas', 'jose de freitas', 39343, -4.7569, -42.5769],
      ['2207900', '22', 'PI', 'Pedro II', 'pedro ii', 37894, -4.4247, -41.4589],
      ['2207009', '22', 'PI', 'Oeiras', 'oeiras', 38161, -7.0250, -42.1314],
      ['2210003', '22', 'PI', 'São Raimundo Nonato', 'sao raimundo nonato', 38944, -9.0150, -42.6989],
      ['2206209', '22', 'PI', 'Miguel Alves', 'miguel alves', 32230, -4.1689, -42.8969],
      ['2205706', '22', 'PI', 'Luís Correia', 'luis correia', 30658, -2.8789, -41.6669],
      ['2208304', '22', 'PI', 'Piracuruca', 'piracuruca', 28846, -3.9289, -41.6919],

      // Principais Municípios do Estado de Mato Grosso
      ['5103403', '51', 'MT', 'Cuiabá', 'cuiaba', 650912, -15.6010, -56.0978],
      ['5108402', '51', 'MT', 'Várzea Grande', 'varzea grande', 299472, -15.6469, -56.1325],
      ['5107602', '51', 'MT', 'Rondonópolis', 'rondonopolis', 244897, -16.4678, -54.6350],
      ['5107909', '51', 'MT', 'Sinop', 'sinop', 196067, -11.8642, -55.5028],
      ['5107958', '51', 'MT', 'Tangará da Serra', 'tangara da serra', 106434, -14.6228, -57.4858],
      ['5102504', '51', 'MT', 'Cáceres', 'caceres', 89681, -16.0719, -57.6789],
      ['5107925', '51', 'MT', 'Sorriso', 'sorriso', 110635, -12.5428, -55.7111],
      ['5105259', '51', 'MT', 'Lucas do Rio Verde', 'lucas do rio verde', 83798, -13.0500, -55.9100],
      ['5107040', '51', 'MT', 'Primavera do Leste', 'primavera do leste', 85146, -15.5569, -54.2989],
      ['5101803', '51', 'MT', 'Barra do Garças', 'barra do garcas', 69210, -15.8900, -52.2569],
      ['5100250', '51', 'MT', 'Alta Floresta', 'alta floresta', 58613, -9.8756, -56.0869],
      ['5106752', '51', 'MT', 'Pontes e Lacerda', 'pontes e lacerda', 52018, -15.2269, -59.3350],
      ['5105101', '51', 'MT', 'Juína', 'juina', 45840, -11.3789, -58.7419],
      ['5102678', '51', 'MT', 'Campo Verde', 'campo verde', 44585, -15.5450, -55.1669],
      ['5105150', '51', 'MT', 'Juara', 'juara', 34906, -11.2589, -57.5189],
      ['5106422', '51', 'MT', 'Peixoto de Azevedo', 'peixoto de azevedo', 32714, -10.2247, -54.9819],
      ['5106224', '51', 'MT', 'Nova Mutum', 'nova mutum', 55759, -13.8328, -56.0819],

      // Principais Municípios do Estado de Mato Grosso do Sul
      ['5002704', '50', 'MS', 'Campo Grande', 'campo grande', 897938, -20.4697, -54.6201],
      ['5003702', '50', 'MS', 'Dourados', 'dourados', 243367, -22.2211, -54.8056],
      ['5008305', '50', 'MS', 'Três Lagoas', 'tres lagoas', 132152, -20.7511, -51.6783],
      ['5003207', '50', 'MS', 'Corumbá', 'corumba', 96268, -19.0069, -57.6539],
      ['5006608', '50', 'MS', 'Ponta Porã', 'ponta pora', 92017, -22.5361, -55.7256],
      ['5006202', '50', 'MS', 'Naviraí', 'navirai', 50457, -23.0650, -54.1969],
      ['5006301', '50', 'MS', 'Nova Andradina', 'nova andradina', 48583, -22.2389, -53.3428],
      ['5007901', '50', 'MS', 'Sidrolândia', 'sidrolandia', 47120, -20.9319, -54.9619],
      ['5001102', '50', 'MS', 'Aquidauana', 'aquidauana', 46803, -20.4711, -55.7869],
      ['5005402', '50', 'MS', 'Maracaju', 'maracaju', 45010, -21.6144, -55.1683],
      ['5006350', '50', 'MS', 'Paranaíba', 'paranaiba', 40957, -19.6769, -51.1908],
      ['5000609', '50', 'MS', 'Amambai', 'amambai', 39325, -23.1042, -55.2258],
      ['5007208', '50', 'MS', 'Rio Brilhante', 'rio brilhante', 37601, -21.8028, -54.5458],
      ['5003306', '50', 'MS', 'Coxim', 'coxim', 32150, -18.5069, -54.7600],
      ['5002407', '50', 'MS', 'Caarapó', 'caarapo', 30612, -22.6342, -54.8219],
      ['5005600', '50', 'MS', 'Miranda', 'miranda', 25595, -20.2400, -56.3769],
      ['5005006', '50', 'MS', 'Jardim', 'jardim', 23985, -21.4289, -56.1381],
      ['5007695', '50', 'MS', 'São Gabriel do Oeste', 'sao gabriel do oeste', 27221, -19.3900, -54.5658],

      // Principais Municípios do Estado de Rondônia
      ['1100205', '11', 'RO', 'Porto Velho', 'porto velho', 460413, -8.7619, -63.9039],
      ['1100122', '11', 'RO', 'Ji-Paraná', 'ji parana', 124333, -10.8828, -61.9519],
      ['1100023', '11', 'RO', 'Ariquemes', 'ariquemes', 96833, -9.9133, -63.0408],
      ['1100304', '11', 'RO', 'Vilhena', 'vilhena', 95832, -12.7406, -60.1458],
      ['1100049', '11', 'RO', 'Cacoal', 'cacoal', 86895, -11.4386, -61.4472],
      ['1100288', '11', 'RO', 'Rolim de Moura', 'rolim de moura', 51661, -11.7275, -61.7714],
      ['1100114', '11', 'RO', 'Jaru', 'jaru', 50592, -10.4389, -62.4664],
      ['1100106', '11', 'RO', 'Guajará-Mirim', 'guajara mirim', 39659, -10.7828, -65.3394],
      ['1100155', '11', 'RO', 'Ouro Preto do Oeste', 'ouro preto do oeste', 35044, -10.7481, -62.2561],
      ['1100189', '11', 'RO', 'Pimenta Bueno', 'pimenta bueno', 34998, -11.6725, -61.1936],
      ['1100452', '11', 'RO', 'Buritis', 'buritis', 27992, -10.2117, -63.8314],
      ['1100130', '11', 'RO', 'Machadinho D\'Oeste', 'machadinho d oeste', 31174, -9.4253, -61.9814],
      ['1100098', '11', 'RO', 'Espigão D\'Oeste', 'espigao d oeste', 29285, -11.5269, -61.0211],
      ['1100015', '11', 'RO', 'Alta Floresta D\'Oeste', 'alta floresta d oeste', 21494, -11.9708, -61.9961],
      ['1100801', '11', 'RO', 'Candeias do Jamari', 'candeias do jamari', 22213, -8.7908, -63.7011],
      ['1100320', '11', 'RO', 'São Miguel do Guaporé', 'sao miguel do guapore', 21689, -11.6931, -62.7144],
      ['1100338', '11', 'RO', 'Nova Mamoré', 'nova mamore', 21162, -10.4078, -65.3325],
      ['1100064', '11', 'RO', 'Colorado do Oeste', 'colorado do oeste', 15663, -13.1206, -60.5450],

      // Principais Municípios do Estado do Acre
      ['1200401', '12', 'AC', 'Rio Branco', 'rio branco', 364756, -9.9753, -67.8100],
      ['1200203', '12', 'AC', 'Cruzeiro do Sul', 'cruzeiro do sul', 91585, -7.6306, -72.6700],
      ['1200500', '12', 'AC', 'Sena Madureira', 'sena madureira', 46511, -9.0658, -68.6569],
      ['1200609', '12', 'AC', 'Tarauacá', 'tarauaca', 43464, -8.1614, -70.7656],
      ['1200302', '12', 'AC', 'Feijó', 'feijo', 34882, -8.1642, -70.3547],
      ['1200104', '12', 'AC', 'Brasiléia', 'brasileia', 26702, -11.0114, -68.7481],
      ['1200450', '12', 'AC', 'Senador Guiomard', 'senador guiomard', 23292, -10.1506, -67.7364],
      ['1200385', '12', 'AC', 'Plácido de Castro', 'placido de castro', 16568, -10.3328, -67.1856],
      ['1200708', '12', 'AC', 'Xapuri', 'xapuri', 19666, -10.6517, -68.5044],
      ['1200252', '12', 'AC', 'Epitaciolândia', 'epitaciolandia', 18708, -11.0286, -68.7408],
      ['1200336', '12', 'AC', 'Mâncio Lima', 'mancio lima', 19300, -7.6142, -72.8958],
      ['1200807', '12', 'AC', 'Porto Acre', 'porto acre', 18882, -9.5878, -67.5322],
      ['1200427', '12', 'AC', 'Rodrigues Alves', 'rodrigues alves', 19351, -7.7419, -72.6483],
      ['1200351', '12', 'AC', 'Marechal Thaumaturgo', 'marechal thaumaturgo', 19280, -8.9406, -72.7917],
      ['1200344', '12', 'AC', 'Manoel Urbano', 'manoel urbano', 9701, -8.8389, -69.2597],
      ['1200393', '12', 'AC', 'Porto Walter', 'porto walter', 12241, -8.2686, -72.7439],
      ['1200013', '12', 'AC', 'Acrelândia', 'acrelandia', 15497, -9.8256, -66.8822],
      ['1200179', '12', 'AC', 'Capixaba', 'capixaba', 12008, -10.5731, -67.6758],

      // Principais Municípios do Estado do Amapá
      ['1600303', '16', 'AP', 'Macapá', 'macapa', 442933, 0.0347, -51.0694],
      ['1600600', '16', 'AP', 'Santana', 'santana', 107373, -0.0583, -51.1817],
      ['1600279', '16', 'AP', 'Laranjal do Jari', 'laranjal do jari', 35114, -0.8419, -52.5161],
      ['1600501', '16', 'AP', 'Oiapoque', 'oiapoque', 27482, 3.8408, -51.8358],
      ['1600535', '16', 'AP', 'Porto Grande', 'porto grande', 17848, 0.7128, -51.4144],
      ['1600402', '16', 'AP', 'Mazagão', 'mazagao', 21924, -0.1156, -51.2894],
      ['1600709', '16', 'AP', 'Tartarugalzinho', 'tartarugalzinho', 12946, 1.5075, -50.9122],
      ['1600154', '16', 'AP', 'Pedra Branca do Amapari', 'pedra branca do amapari', 12847, 0.7781, -51.9511],
      ['1600808', '16', 'AP', 'Vitória do Jari', 'vitoria do jari', 11291, -0.9381, -52.4222],
      ['1600204', '16', 'AP', 'Calçoene', 'calcoene', 10612, 2.4981, -50.9508],
      ['1600105', '16', 'AP', 'Amapá', 'amapa', 7943, 2.0522, -50.7961],
      ['1600238', '16', 'AP', 'Ferreira Gomes', 'ferreira gomes', 6714, 0.8581, -51.1803],
      ['1600212', '16', 'AP', 'Cutias', 'cutias', 4475, 0.9844, -50.8014],
      ['1600253', '16', 'AP', 'Itaubal', 'itaubal', 4265, 0.6019, -50.6881],
      ['1600550', '16', 'AP', 'Pracuúba', 'pracuuba', 3803, 1.7458, -50.7853],
      ['1600055', '16', 'AP', 'Serra do Navio', 'serra do navio', 4673, 0.9014, -52.0028],

      // Principais Municípios do Estado de Roraima
      ['1400100', '14', 'RR', 'Boa Vista', 'boa vista', 413486, 2.8235, -60.6758],
      ['1400472', '14', 'RR', 'Rorainópolis', 'rorainopolis', 32647, 0.9461, -60.4136],
      ['1400209', '14', 'RR', 'Caracaraí', 'caracarai', 20957, 1.8156, -61.1283],
      ['1400456', '14', 'RR', 'Pacaraima', 'pacaraima', 19305, 4.4789, -61.1472],
      ['1400175', '14', 'RR', 'Cantá', 'canta', 18682, 2.6108, -60.6044],
      ['1400308', '14', 'RR', 'Mucajaí', 'mucajai', 18171, 2.4339, -60.9019],
      ['1400050', '14', 'RR', 'Alto Alegre', 'alto alegre', 15380, 2.9869, -61.3069],
      ['1400159', '14', 'RR', 'Bonfim', 'bonfim', 12557, 3.3589, -59.8322],
      ['1400027', '14', 'RR', 'Amajari', 'amajari', 13927, 3.6519, -61.4219],
      ['1400282', '14', 'RR', 'Iracema', 'iracema', 10023, 2.1811, -61.3919],
      ['1400233', '14', 'RR', 'Caroebe', 'caroebe', 10383, 0.8819, -59.6942],
      ['1400407', '14', 'RR', 'Normandia', 'normandia', 13669, 3.8822, -59.6269],
      ['1400704', '14', 'RR', 'Uiramutã', 'uiramuta', 13751, 4.5958, -60.1656],
      ['1400506', '14', 'RR', 'São João da Baliza', 'sao joao da baliza', 8858, 0.9519, -59.9119],
      ['1400605', '14', 'RR', 'São Luiz', 'sao luiz', 7315, 0.9856, -60.1014],

      // Principais Municípios do Estado do Tocantins
      ['1721000', '17', 'TO', 'Palmas', 'palmas', 302692, -10.2491, -48.3242],
      ['1702109', '17', 'TO', 'Araguaína', 'araguaina', 171301, -7.1911, -48.2072],
      ['1709500', '17', 'TO', 'Gurupi', 'gurupi', 85126, -11.7292, -49.0678],
      ['1718204', '17', 'TO', 'Porto Nacional', 'porto nacional', 53311, -10.7083, -48.4172],
      ['1716109', '17', 'TO', 'Paraíso do Tocantins', 'paraiso do tocantins', 52360, -10.1753, -48.8828],
      ['1705508', '17', 'TO', 'Colinas do Tocantins', 'colinas do tocantins', 34229, -8.0583, -48.4756],
      ['1709302', '17', 'TO', 'Guaraí', 'guarai', 24775, -8.8336, -48.5133],
      ['1721208', '17', 'TO', 'Tocantinópolis', 'tocantinopolis', 22615, -6.3264, -47.4206],
      ['1707009', '17', 'TO', 'Dianópolis', 'dianopolis', 22424, -11.6286, -46.8206],
      ['1708205', '17', 'TO', 'Formoso do Araguaia', 'formoso do araguaia', 18881, -11.7958, -49.5303],
      ['1713205', '17', 'TO', 'Miracema do Tocantins', 'miracema do tocantins', 18566, -9.5661, -48.3967],
      ['1702554', '17', 'TO', 'Augustinópolis', 'augustinopolis', 18408, -5.4667, -47.8828],
      ['1720903', '17', 'TO', 'Taguatinga', 'taguatinga', 14068, -12.4042, -46.5719],
      ['1716505', '17', 'TO', 'Pedro Afonso', 'pedro afonso', 14065, -8.9669, -48.1758],
      ['1722107', '17', 'TO', 'Xambioá', 'xambioa', 10831, -6.4111, -48.5364],

      // Principais Municípios do Estado do Espírito Santo
      ['3205200', '32', 'ES', 'Vila Velha', 'vila velha', 502899, -20.3297, -40.2925],
      ['3205002', '32', 'ES', 'Serra', 'serra', 520653, -20.1286, -40.3078],
      ['3201308', '32', 'ES', 'Cariacica', 'cariacica', 383917, -20.2639, -40.4200],
      ['3201209', '32', 'ES', 'Cachoeiro de Itapemirim', 'cachoeiro de itapemirim', 210589, -20.8489, -41.1128],
      ['3203205', '32', 'ES', 'Linhares', 'linhares', 176688, -19.3911, -40.0722],
      ['3201506', '32', 'ES', 'Colatina', 'colatina', 123400, -19.5392, -40.6300],
      ['3202405', '32', 'ES', 'Guarapari', 'guarapari', 126783, -20.6722, -40.4983],
      ['3204906', '32', 'ES', 'São Mateus', 'sao mateus', 132642, -18.7161, -39.8589],
      ['3200607', '32', 'ES', 'Aracruz', 'aracruz', 103101, -19.8203, -40.2733],
      ['3205101', '32', 'ES', 'Viana', 'viana', 79238, -20.3889, -40.4950],
      ['3203320', '32', 'ES', 'Marataízes', 'marataizes', 38883, -21.0433, -40.8244],
      ['3203908', '32', 'ES', 'Nova Venécia', 'nova venecia', 50462, -18.7106, -40.4006],

      // Principais Municípios do Estado de São Paulo
      ['3509502', '35', 'SP', 'Campinas', 'campinas', 1213000, -22.9056, -47.0608],
      ['3518800', '35', 'SP', 'Guarulhos', 'guarulhos', 1392000, -23.4538, -46.5333],
      ['3548708', '35', 'SP', 'São Bernardo do Campo', 'sao bernardo do campo', 844000, -23.6914, -46.5647],
      ['3547809', '35', 'SP', 'Santo André', 'santo andre', 723000, -23.6639, -46.5383],
      ['3534401', '35', 'SP', 'Osasco', 'osasco', 699000, -23.5329, -46.7920],
      ['3548500', '35', 'SP', 'Santos', 'santos', 433000, -23.9608, -46.3339],
      ['3549904', '35', 'SP', 'São José dos Campos', 'sao jose dos campos', 729000, -23.1896, -45.8841],
      ['3543402', '35', 'SP', 'Ribeirão Preto', 'ribeirao preto', 711000, -21.1767, -47.8108],
      ['3552205', '35', 'SP', 'Sorocaba', 'sorocaba', 687000, -23.5015, -47.4526],
      ['3548807', '35', 'SP', 'São Caetano do Sul', 'sao caetano do sul', 161000, -23.6229, -46.5550],
      ['3530607', '35', 'SP', 'Mogi das Cruzes', 'mogi das cruzes', 450000, -23.5208, -46.1853],
      ['3530805', '35', 'SP', 'Mogi Mirim', 'mogi mirim', 93000, -22.4319, -46.9583],
      ['3530706', '35', 'SP', 'Mogi Guaçu', 'mogi guacu', 153000, -22.3703, -46.9428],
      ['3515004', '35', 'SP', 'Embu das Artes', 'embu das artes', 276000, -23.6492, -46.8522],
      ['3506003', '35', 'SP', 'Bauru', 'bauru', 379000, -22.3147, -49.0606],
      ['3538709', '35', 'SP', 'Piracicaba', 'piracicaba', 407000, -22.7253, -47.6492],
      ['3525904', '35', 'SP', 'Jundiaí', 'jundiai', 423000, -23.1857, -46.8978],
      ['3549805', '35', 'SP', 'São José do Rio Preto', 'sao jose do rio preto', 469000, -20.8113, -49.3758],
      ['3550605', '35', 'SP', 'São Roque', 'sao roque', 92000, -23.5292, -47.1353],
      ['3551009', '35', 'SP', 'São Vicente', 'sao vicente', 368000, -23.9631, -46.3919],
      ['3548906', '35', 'SP', 'São Carlos', 'sao carlos', 254000, -22.0175, -47.8908],
      ['3550704', '35', 'SP', 'São Sebastião', 'sao sebastiao', 90000, -23.7608, -45.4097],
      ['3549102', '35', 'SP', 'São João da Boa Vista', 'sao joao da boa vista', 91000, -21.9686, -46.7978],
      ['3516101', '35', 'SP', 'Florínea', 'florinea', 2800, -22.8683, -50.6931],
      ['3545803', '35', 'SP', 'Santa Bárbara d\'Oeste', 'santa barbara doeste', 194000, -22.7556, -47.4142],
      ['3547304', '35', 'SP', 'Santana de Parnaíba', 'santana de parnaiba', 145000, -23.4442, -46.9189],
      ['3505708', '35', 'SP', 'Barueri', 'barueri', 276000, -23.5111, -46.8764],
      ['3513801', '35', 'SP', 'Diadema', 'diadema', 426000, -23.6865, -46.6228],
      ['3510609', '35', 'SP', 'Carapicuíba', 'carapicuiba', 403000, -23.5222, -46.8356],
      ['3554102', '35', 'SP', 'Taubaté', 'taubate', 318000, -23.0264, -45.5553],
      ['3516200', '35', 'SP', 'Franca', 'franca', 358000, -20.5386, -47.4008],
      ['3529005', '35', 'SP', 'Marília', 'marilia', 240000, -22.2139, -49.9458],
      ['3541406', '35', 'SP', 'Presidente Prudente', 'presidente prudente', 231000, -22.1256, -51.3889],
      ['3503208', '35', 'SP', 'Araraquara', 'araraquara', 238000, -21.7944, -48.1767],
      ['3524402', '35', 'SP', 'Jacareí', 'jacarei', 235000, -23.3056, -45.9658],
      ['3541000', '35', 'SP', 'Praia Grande', 'praia grande', 330000, -24.0058, -46.4028]
    ];
    for (const m of allMunis) {
      await libsqlClient.execute({
        sql: `INSERT OR REPLACE INTO geographic_municipalities 
              (code, state_code, state_acronym, name, normalized_name, population, latitude, longitude) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: m
      });
    }
  }).catch(() => {});

  dbInstance = drizzleLibsql(libsqlClient, { schema });
  dbInstance.execute = async (query: any) => {
    if (typeof query === 'string') {
      const res = await libsqlClient.execute(query);
      return res.rows;
    }
    if (query && typeof query === 'object') {
      try {
        const prepared = dbInstance.dialect.sqlToQuery(query);
        const res = await libsqlClient.execute({ sql: prepared.sql, args: prepared.params });
        return res.rows;
      } catch {
        const sqlText = query.sql || query.text;
        if (sqlText) {
          const res = await libsqlClient.execute({ sql: sqlText, args: query.params || [] });
          return res.rows;
        }
      }
    }
    return [];
  };

  queryClientInstance = (first: any, ...values: any[]) => {
    if (Array.isArray(first) && 'raw' in first) {
      let query = first[0];
      for (let i = 0; i < values.length; i++) {
        query += '?' + first[i + 1];
      }
      return libsqlClient.execute({ sql: query, args: values }).then(r => r.rows);
    }
    return first;
  };
} else {
  // Configuração padrão de PostgreSQL
  let connectionString = rawConn;
  if (connectionString.startsWith("postgres")) {
    const parts = connectionString.split('@');
    if (parts.length > 1) {
      const lastAt = connectionString.lastIndexOf('@');
      const credentials = connectionString.substring(0, lastAt); 
      const hostPart = connectionString.substring(lastAt); 
      
      const protoEnd = credentials.indexOf('://');
      if (protoEnd !== -1) { 
        const proto = credentials.substring(0, protoEnd + 3);
        const auth = credentials.substring(protoEnd + 3); 
        const colonIndex = auth.indexOf(':');
        if (colonIndex !== -1) {
          const user = auth.substring(0, colonIndex);
          let pass = auth.substring(colonIndex + 1);
          
          if (pass.includes('#') || pass.includes('@')) {
            try { pass = decodeURIComponent(pass); } catch(e) {}
            pass = encodeURIComponent(pass);
            connectionString = proto + user + ':' + pass + hostPart;
          }
        }
      }
    }
  }

  queryClientInstance = postgres(connectionString, { max: 10, idle_timeout: 10, connect_timeout: 10 });
  dbInstance = drizzlePg(queryClientInstance, { schema });

  // Seed seguro de estados e capitais no PostgreSQL apenas se a tabela já tiver sido criada pelas migrations
  (async () => {
    try {
      const tableCheck = await queryClientInstance`
        SELECT to_regclass('public.geographic_states') as tbl_states,
               to_regclass('public.geographic_municipalities') as tbl_munis
      `;

      if (tableCheck[0]?.tbl_states) {
        const statesCount = await queryClientInstance`SELECT count(*)::int as count FROM geographic_states`;
        if (statesCount[0]?.count === 0) {
          console.log('[PostgreSQL] Populando 27 estados da federação...');
          const statesData = [
            ['11', 'RO', 'Rondônia', 'Norte'], ['12', 'AC', 'Acre', 'Norte'], ['13', 'AM', 'Amazonas', 'Norte'],
            ['14', 'RR', 'Roraima', 'Norte'], ['15', 'PA', 'Pará', 'Norte'], ['16', 'AP', 'Amapá', 'Norte'],
            ['17', 'TO', 'Tocantins', 'Norte'], ['21', 'MA', 'Maranhão', 'Nordeste'], ['22', 'PI', 'Piauí', 'Nordeste'],
            ['23', 'CE', 'Ceará', 'Nordeste'], ['24', 'RN', 'Rio Grande do Norte', 'Nordeste'], ['25', 'PB', 'Paraíba', 'Nordeste'],
            ['26', 'PE', 'Pernambuco', 'Nordeste'], ['27', 'AL', 'Alagoas', 'Nordeste'], ['28', 'SE', 'Sergipe', 'Nordeste'],
            ['29', 'BA', 'Bahia', 'Nordeste'], ['31', 'MG', 'Minas Gerais', 'Sudeste'], ['32', 'ES', 'Espírito Santo', 'Sudeste'],
            ['33', 'RJ', 'Rio de Janeiro', 'Sudeste'], ['35', 'SP', 'São Paulo', 'Sudeste'], ['41', 'PR', 'Paraná', 'Sul'],
            ['42', 'SC', 'Santa Catarina', 'Sul'], ['43', 'RS', 'Rio Grande do Sul', 'Sul'], ['50', 'MS', 'Mato Grosso do Sul', 'Centro-Oeste'],
            ['51', 'MT', 'Mato Grosso', 'Centro-Oeste'], ['52', 'GO', 'Goiás', 'Centro-Oeste'], ['53', 'DF', 'Distrito Federal', 'Centro-Oeste']
          ];
          for (const s of statesData) {
            await queryClientInstance`
              INSERT INTO geographic_states (code, acronym, name, region)
              VALUES (${s[0]}, ${s[1]}, ${s[2]}, ${s[3]})
              ON CONFLICT (code) DO NOTHING
            `;
          }
        }
      }

      if (tableCheck[0]?.tbl_munis) {
        const munisCount = await queryClientInstance`SELECT count(*)::int as count FROM geographic_municipalities`;
        if (munisCount[0]?.count === 0) {
          console.log('[PostgreSQL] Populando municípios e capitais do Brasil...');
          const munisToInsert = [
            ['1100205', '11', 'RO', 'Porto Velho', 'porto velho', 548952, -8.7619, -63.9039],
            ['1200401', '12', 'AC', 'Rio Branco', 'rio branco', 419231, -9.9753, -67.8105],
            ['1302603', '13', 'AM', 'Manaus', 'manaus', 2063547, -3.1190, -60.0217],
            ['1400100', '14', 'RR', 'Boa Vista', 'boa vista', 413486, 2.8235, -60.6758],
            ['1501402', '15', 'PA', 'Belém', 'belem', 1303389, -1.4558, -48.4902],
            ['1600303', '16', 'AP', 'Macapá', 'macapa', 442933, 0.0389, -51.0664],
            ['1721000', '17', 'TO', 'Palmas', 'palmas', 302692, -10.1844, -48.3336],
            ['2111300', '21', 'MA', 'São Luís', 'sao luis', 1037775, -2.5307, -44.3068],
            ['2211001', '22', 'PI', 'Teresina', 'teresina', 866300, -5.0920, -42.8038],
            ['2304400', '23', 'CE', 'Fortaleza', 'fortaleza', 2428678, -3.7319, -38.5267],
            ['2408102', '24', 'RN', 'Natal', 'natal', 751300, -5.7945, -35.2110],
            ['2507507', '25', 'PB', 'João Pessoa', 'joao pessoa', 833932, -7.1195, -34.8450],
            ['2611606', '26', 'PE', 'Recife', 'recife', 1488920, -8.0476, -34.8770],
            ['2704302', '27', 'AL', 'Maceió', 'maceio', 957916, -9.6658, -35.7353],
            ['2800308', '28', 'SE', 'Aracaju', 'aracaju', 602757, -10.9472, -37.0731],
            ['2927408', '29', 'BA', 'Salvador', 'salvador', 2418005, -12.9777, -38.5016],
            ['3106200', '31', 'MG', 'Belo Horizonte', 'belo horizonte', 2315560, -19.9208, -43.9378],
            ['3205309', '32', 'ES', 'Vitória', 'vitoria', 322869, -20.3155, -40.3128],
            ['3304557', '33', 'RJ', 'Rio de Janeiro', 'rio de janeiro', 6211423, -22.9068, -43.1729],
            ['3550308', '35', 'SP', 'São Paulo', 'sao paulo', 11451245, -23.5505, -46.6333],
            ['3509502', '35', 'SP', 'Campinas', 'campinas', 1139047, -22.9056, -47.0608],
            ['3518800', '35', 'SP', 'Guarulhos', 'guarulhos', 1291771, -23.4542, -46.5333],
            ['3548708', '35', 'SP', 'São Bernardo do Campo', 'sao bernardo do campo', 810729, -23.6914, -46.5646],
            ['3547809', '35', 'SP', 'Santo André', 'santo andre', 748919, -23.6572, -46.5333],
            ['3548807', '35', 'SP', 'São Caetano do Sul', 'sao caetano do sul', 165655, -23.6229, -46.5544],
            ['3534401', '35', 'SP', 'Osasco', 'osasco', 728615, -23.5325, -46.7917],
            ['3549904', '35', 'SP', 'São José dos Campos', 'sao jose dos campos', 697054, -23.1794, -45.8869],
            ['3543402', '35', 'SP', 'Ribeirão Preto', 'ribeirao preto', 698642, -21.1767, -47.8108],
            ['3552205', '35', 'SP', 'Sorocaba', 'sorocaba', 723682, -23.5017, -47.4581],
            ['3548500', '35', 'SP', 'Santos', 'santos', 418608, -23.9608, -46.3336],
            ['4106902', '41', 'PR', 'Curitiba', 'curitiba', 1773733, -25.4290, -49.2671],
            ['4205407', '42', 'SC', 'Florianópolis', 'florianopolis', 537213, -27.5954, -48.5480],
            ['4314902', '43', 'RS', 'Porto Alegre', 'porto alegre', 1332570, -30.0346, -51.2177],
            ['5002704', '50', 'MS', 'Campo Grande', 'campo grande', 897938, -20.4697, -54.6201],
            ['5103403', '51', 'MT', 'Cuiabá', 'cuiaba', 650912, -15.6014, -56.0979],
            ['5208707', '52', 'GO', 'Goiânia', 'goiania', 1437237, -16.6869, -49.2648],
            ['5300108', '53', 'DF', 'Brasília', 'brasilia', 2817068, -15.7942, -47.8822]
          ];

          for (const m of munisToInsert) {
            await queryClientInstance`
              INSERT INTO geographic_municipalities (code, state_code, state_acronym, name, normalized_name, population, latitude, longitude)
              VALUES (${m[0]}, ${m[1]}, ${m[2]}, ${m[3]}, ${m[4]}, ${m[5]}, ${m[6]}, ${m[7]})
              ON CONFLICT (code) DO NOTHING
            `;
          }
          console.log('[PostgreSQL] Seed inicial de municípios concluído com sucesso.');
        }
      }
    } catch (e: any) {
      console.warn('[PostgreSQL] Aviso ao verificar/popular tabelas iniciais:', e.message);
    }
  })();
}

export const queryClient = queryClientInstance;
export const db = dbInstance;

