import { GeoNormalizationService } from '../src/services/GeoNormalizationService.js';
import { SafetyAnalysisService } from '../src/services/SafetyAnalysisService.js';
import assert from 'assert';

console.log("=== INICIANDO AUDITORIA DA CAMADA DE DADOS GEOGRÁFICOS E QUALIDADE ===");

// 1. Validação de Códigos IBGE de Estados
console.log("\n[1/5] Testando validação de códigos IBGE de Estados...");
assert.strictEqual(GeoNormalizationService.isValidIbgeStateCode('35'), true, 'SP (35) deve ser válido');
assert.strictEqual(GeoNormalizationService.isValidIbgeStateCode('33'), true, 'RJ (33) deve ser válido');
assert.strictEqual(GeoNormalizationService.isValidIbgeStateCode('53'), true, 'DF (53) deve ser válido');
assert.strictEqual(GeoNormalizationService.isValidIbgeStateCode('99'), false, 'Estado 99 deve ser inválido');
assert.strictEqual(GeoNormalizationService.isValidIbgeStateCode('abc'), false, 'Texto não deve ser código de estado');
console.log("✓ Validação de Estados IBGE: OK");

// 2. Validação de Códigos IBGE de Municípios (6 e 7 dígitos com DV Módulo 10)
console.log("\n[2/5] Testando cálculo de dígito verificador e validação de Municípios IBGE...");
// São Paulo: 3550308 (dígito 8)
assert.strictEqual(GeoNormalizationService.calculateIbgeCheckDigit('355030'), 8, 'DV de São Paulo deve ser 8');
assert.strictEqual(GeoNormalizationService.isValidIbgeMunicipalityCode('3550308'), true, '3550308 deve ser válido');

// Rio de Janeiro: 3304557 (dígito 7)
assert.strictEqual(GeoNormalizationService.calculateIbgeCheckDigit('330455'), 7, 'DV do Rio de Janeiro deve ser 7');
assert.strictEqual(GeoNormalizationService.isValidIbgeMunicipalityCode('3304557'), true, '3304557 deve ser válido');

// Código com DV corrompido
assert.strictEqual(GeoNormalizationService.isValidIbgeMunicipalityCode('3550309'), false, '3550309 tem DV errado e deve ser rejeitado');
// Código com estado inexistente
assert.strictEqual(GeoNormalizationService.isValidIbgeMunicipalityCode('9900015'), false, 'Estado inexistente deve ser rejeitado');
// Código de 6 dígitos
assert.strictEqual(GeoNormalizationService.isValidIbgeMunicipalityCode('355030'), true, 'Código legado de 6 dígitos deve ser aceito');
console.log("✓ Validação de Municípios IBGE com dígito verificador: OK");

// 3. Validação de Coordenadas Geográficas (SRID 4326 / WGS84)
console.log("\n[3/5] Testando validação de coordenadas, limites do Brasil e inversão...");

// Coordenada válida no Brasil
const validCoord = GeoNormalizationService.validateCoordinates(-23.55052, -46.633308);
assert.strictEqual(validCoord.valid, true);
assert.strictEqual(validCoord.precision, 'exact');
assert.strictEqual(validCoord.wasInverted, false);

// Null Island (0, 0) deve ser REJEITADO
const nullIsland = GeoNormalizationService.validateCoordinates(0, 0);
assert.strictEqual(nullIsland.valid, false, 'Null Island (0,0) deve ser rejeitado');

// Coordenadas fora do Brasil (ex: Paris)
const paris = GeoNormalizationService.validateCoordinates(48.8566, 2.3522);
assert.strictEqual(paris.valid, false, 'Coordenadas fora do Brasil devem ser rejeitadas');

// Coordenadas invertidas (lat=-46.63, lon=-23.55) -> Deve detectar e corrigir!
const inverted = GeoNormalizationService.validateCoordinates(-46.6333, -23.5505);
assert.strictEqual(inverted.valid, true, 'Inversão lat/lon deve ser detectada como recuperável');
assert.strictEqual(inverted.wasInverted, true, 'Flag wasInverted deve ser true');
assert.strictEqual(inverted.latitude, -23.5505);
assert.strictEqual(inverted.longitude, -46.6333);

// Valores nulos ou ausentes
const emptyCoord = GeoNormalizationService.validateCoordinates(null, undefined);
assert.strictEqual(emptyCoord.valid, false);
console.log("✓ Validação de coordenadas, SRID e detecção de inversão: OK");

// 4. Normalização de Nomes e Aliases Canônicos
console.log("\n[4/5] Testando normalização de acentos e resolução de nomes divergentes...");
assert.strictEqual(GeoNormalizationService.normalizeText("São Paulo / SP!"), "sao paulo sp");
assert.strictEqual(GeoNormalizationService.canonicalizeMunicipalityName("S. Paulo"), "sao paulo");
assert.strictEqual(GeoNormalizationService.canonicalizeMunicipalityName("CAPITAL"), "sao paulo");
assert.strictEqual(GeoNormalizationService.canonicalizeMunicipalityName("Florínia"), "florinea");
assert.strictEqual(GeoNormalizationService.canonicalizeMunicipalityName("Embu"), "embu das artes");
assert.strictEqual(GeoNormalizationService.canonicalizeMunicipalityName("Moji Mirim"), "mogi mirim");
assert.strictEqual(GeoNormalizationService.canonicalizeMunicipalityName("S. Bernardo do Campo"), "sao bernardo do campo");
console.log("✓ Normalização de nomes e resolução de divergências toponímicas: OK");

// 5. Regras Obrigatórias de Qualidade de Dados no SafetyAnalysisService
console.log("\n[5/5] Testando regras obrigatórias do SafetyAnalysisService...");
async function runAnalysisQualityChecks() {
  const service = new SafetyAnalysisService();

  // Caso 1: Coordenadas no mar ou local sem cobertura oficial
  // Regra: "Ausência de dados não pode virar score zero" e "Ausência de dados não pode ser interpretada como ausência de crimes"
  const oceanResult = await service.analyze({
    lat: -25.0, // Oceano atlântico
    lon: -40.0,
    radiusMeters: 1000
  });

  assert.strictEqual(oceanResult.score, null, 'Score DEVE ser null quando não há dados, NUNCA zero');
  assert.strictEqual(oceanResult.status, 'insufficient_data', 'Status deve ser insufficient_data');
  assert.strictEqual(oceanResult.confidence, 0, 'Confiança deve ser 0 quando ausente');
  assert.ok(oceanResult.dataAbsenceNotice?.includes('Ausência de'), 'Deve conter aviso explícito de que ausência de dados não significa ausência de crimes');

  console.log("✓ Regra 'Ausência de dados não vira score zero': OK");
  console.log("✓ Regra 'Ausência de dados informada explicitamente com aviso regulatório': OK");
  console.log("✓ Regra 'Confiança separada de Segurança': OK");
}

runAnalysisQualityChecks().then(() => {
  console.log("\n========================================================");
  console.log(" TODOS OS TESTES DA CAMADA GEOGRÁFICA E QUALIDADE PASSARAM!");
  console.log("========================================================");
  process.exit(0);
}).catch(err => {
  console.error("ERRO nos testes:", err);
  process.exit(1);
});
