# Regras de Qualidade e Dados Geográficos (DATA QUALITY RULES)

Este documento consolida a auditoria, as correções implementadas e as regras normativas para governança da camada de dados geográficos, integridade referencial e confiabilidade analítica do sistema de segurança pública.

---

## 1. Resumo Executivo da Auditoria

A auditoria identificou vulnerabilidades que comprometiam a integridade das análises quando consultadas por coordenadas ou municípios:
1. **Fallback de Simulação (Mock Data) no Cálculo de Risco:** Quando o banco não continha dados para determinado raio geográfico ou quando ocorria falha de conectividade, um algoritmo gerava pontuações pseudoaleatórias simuladas (`Math.floor(Math.abs(lat + lon) * 100) % 60 + 30`), violando a premissa de que a ausência de dados oficiais nunca deve ser mascarada.
2. **Ausência de Dados Tratada como Risco Zero ou Arbitrário:** Locais sem registros cadastrados geravam inconsistências ou retornavam `0`, confundindo "ausência de dados cadastrados" com "ausência de ocorrências criminais".
3. **Fragilidade nas Chaves de Fontes e Filtros Espaciais:** Nomes de arquivos temporários estavam fixados no código (ex: `'SSP-SP (sample_1788974125648.csv)'`), inviabilizando consultas sobre dados reais ingeridos pelo pipeline oficial.
4. **Acoplamento Monolítico a Funções Exclusivas de PostGIS:** Queries utilizavam funções PostGIS (`ST_Contains`, `ST_Distance`, `ST_SetSRID`) sem mecanismo resiliente de fallback espacial para ambientes SQLite locais, gerando exceções em buscas fora de instâncias PostgreSQL.
5. **Falta de Validação Estruturada de Códigos IBGE e Coordenadas:** Não havia verificação algorítmica do dígito verificador módulo-10 de municípios nem detecção automática de inversão de coordenadas (latitude vs longitude).
6. **Ambiguidade entre Confiança e Segurança:** O índice de confiança amostral não estava devidamente separado do Safety Score, gerando o risco de o usuário confundir alta confiança no dado com local seguro.

---

## 2. Problemas Encontrados e Correções Aplicadas

| Dimensão | Problema Encontrado | Correção Aplicada |
| :--- | :--- | :--- |
| **Códigos IBGE** | Aceitação de strings arbitrárias; ausência de conferência de dígito verificador. | Implementada validação de estados (códigos 11 a 53) e verificação do DV módulo 10 para códigos de municípios de 7 dígitos (`GeoNormalizationService.isValidIbgeMunicipalityCode`). |
| **Estados (UFs)** | Ausência de tabela relacional normalizada com constraints. | Criada tabela `geographic_states` com constraint `PRIMARY KEY (code)` e relacionamento FK na tabela `geographic_municipalities.state_code`. Todos os 27 estados pré-populados. |
| **Municípios** | Resolução toponímica sujeita a falhas por abreviações ("S. Paulo", "Florinia", "Embu"). | Mapeamento de sinônimos canônicos (`MUNICIPALITY_ALIASES`) e normalização semântica (remoção de diacríticos, unificação de espaços). |
| **Coordenadas** | Ausência de validação de *bounding box* do território brasileiro; risco de *Null Island* `(0, 0)`. | Implementado `validateCoordinates(lat, lon)`: rejeição estrita de `(0,0)`, limites do Brasil $[-34.0, 5.5]$ de latitude e $[-74.5, -34.0]$ de longitude. |
| **Inversão Lat/Lon** | Coordenadas trocadas (lat na faixa de lon e vice-versa) causavam silêncio em queries espaciais. | Detecção automática de coordenadas invertidas com reposicionamento e marcação de precisão. |
| **Geometrias / SRID** | PostGIS fixado como dependência rígida sem fallback. | Suporte dual-mode: PostGIS nativo com `ST_Contains`/`ST_Distance` em PostgreSQL e Bounding Box indexado + Haversine em SQLite (`lib/geo.ts`). |
| **Índices Espaciais** | Ausência de índices compostos para busca geoespacial rápida. | Adicionados índices espaciais `geomIdx` (PostGIS GIST), `idx_occ_coords` em `(latitude, longitude)`, e `idx_muni_coords` em municípios. |
| **Duplicidade Nacional vs Estadual** | Risco de somar dados agregados do SINESP com ocorrências da SSP-SP no mesmo raio. | Implementada regra de precedência: estados com integração direta oficial utilizam fonte estadual primária; SINESP só atua como fonte complementar quando o estado não possui cobertura direta. |
| **Dados Granulares vs Agregados** | Possibilidade de plotar centróides municipais como se fossem pontos reais de crimes. | Adicionada coluna `is_synthetic_point` na tabela `security_occurrences` e `granularity` em `security_indicators`. Pontos agregados são explicitamente sinalizados e não geram marcadores pontuais falsos. |
| **Fallback com Mock Data** | O `SafetyAnalysisService` gerava dados simulados em caso de erro. | Removido completamente o mock. O serviço agora retorna `score: null`, `status: 'insufficient_data'`, `confidence: 0` e disclaimer explícito. |

---

## 3. As 8 Regras Obrigatórias de Qualidade de Dados

### Regra 1: Ausência de dados não pode virar score zero
- **Diretriz:** Se um local, raio ou período não possui registros oficiais no banco de dados, o campo `score.value` deve ser estritamente `null` (exibido na interface como `"-"`), e a classificação deve ser `"Dados insuficientes"`.
- **Justificativa:** Atribuir nota 0 a uma região sem dados comunicaria errôneamente que o local é extremamente perigoso, quando na verdade não há dados cadastrados.

### Regra 2: Ausência de dados não pode ser interpretada como ausência de crimes
- **Diretriz:** Toda resposta sem registros oficiais deve ser acompanhada do aviso regulatório:
  > *"Ausência de registros oficiais reflete falta de cobertura ou dados não publicados pelo órgão responsável e NÃO deve ser interpretada como inexistência de crimes."*
- **Justificativa:** O silêncio estatístico ou a subnotificação não equivalem à segurança real.

### Regra 3: Não criar pontos artificiais para dados agregados sem explicitar
- **Diretriz:** É expressamente proibido inventar coordenadas pontuais de latitude/longitude para representar estatísticas que foram fornecidas em nível municipal ou regional. Se um ponto sintético (ex: centróide) for estritamente necessário para visualização esquemática, o atributo `is_synthetic_point` deve ser gravado como `true`, e a interface deve renderizar a área municipal e não marcadores pontuais de ocorrência.

### Regra 4: Não misturar fontes incompatíveis sem regra documentada
- **Diretriz:** Não é permitido mesclar taxas de criminalidade calculadas sob metodologias distintas (ex: crimes consumados vs tentados, furtos de objetos vs roubos qualificados) em uma mesma série estatística sem normalização prévia para a taxonomia canônica unificada (`Taxonomy.ts`).

### Regra 5: Não somar dados nacionais e estaduais duplicados
- **Diretriz:** Para uma dada região e período, a análise deve selecionar uma única fonte primária governante segundo a matriz de prioridade oficial (`SourcePriority.ts`):
  1. Se existe fonte estadual direta validada (ex: SSP-SP em São Paulo), ela tem precedência exclusiva.
  2. A fonte nacional (SINESP) é utilizada apenas para municípios/estados que não possuem adaptador estadual próprio.
  3. Dados estaduais e nacionais **nunca** são somados no mesmo período para evitar dupla contagem.

### Regra 6: Toda informação deve possuir fonte e período
- **Diretriz:** Todo registro em `security_occurrences` e `security_indicators` deve conter obrigatoriamente:
  - `source_id`: identificador da fonte produtora do dado;
  - `period` ou `occurred_at`: marco temporal do evento;
  - `data_import_id`: vínculo com o lote de ingestão para rastreabilidade e auditoria.

### Regra 7: Toda análise deve informar o nível de cobertura
- **Diretriz:** O payload da análise deve informar explicitamente a cobertura geográfica (`coverage.geographic`), temporal (`coverage.temporal`) e o nível de precisão espacial (`spatial_precision: 'exact' | 'approximate' | 'aggregated' | 'unknown'`).

### Regra 8: Confiança não é a mesma coisa que segurança
- **Diretriz:** O índice de **Confiança** reflete a completude amostral, frescor temporal e qualidade da fonte que originou o dado. O **Safety Score** reflete a estimativa de risco criminal ponderado. Um local com nota de segurança baixa pode ter 95% de confiança (dados fidedignos comprovando alto número de crimes), assim como um local sem dados terá confiança 0% e Safety Score nulo.

---

## 4. Algoritmos e Validações Implementadas

### 4.1 Validação do Dígito Verificador IBGE (Módulo 10)
Os municípios brasileiros possuem código oficial de 7 dígitos fornecido pelo IBGE, onde o 7º dígito é calculado com base nos 6 primeiros dígitos pelos pesos alternados `[1, 2, 1, 2, 1, 2]`:
```typescript
static calculateIbgeCheckDigit(first6Digits: string): number {
  const weights = [1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    let product = parseInt(first6Digits[i], 10) * weights[i];
    if (product > 9) {
      product = Math.floor(product / 10) + (product % 10);
    }
    sum += product;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : (10 - remainder);
}
```

### 4.2 Validação de Coordenadas e Correção de Inversão
```typescript
// Detecção de inversão: latitude brasileira está em [-34.0, 5.5] e longitude em [-74.5, -34.0]
if (nLat >= -74.5 && nLat <= -34.0 && nLon >= -34.5 && nLon <= 6.0) {
  // Coordenadas invertidas corrigidas automaticamente:
  const fixedLat = nLon;
  const fixedLon = nLat;
  ...
}
```

---

## 5. Limitações Remanescentes e Recomendações

1. **Malhas Vetoriais Poligonais Detalhadas:** O schema atual armazena geometrias pontuais ou centróides de municípios. Para cálculo exato de polígonos de fronteira municipal via PostGIS `ST_Contains` em 100% dos 5.570 municípios, recomenda-se a ingestão do shapefile/GeoJSON oficial de limites municipais do IBGE.
2. **Subnotificação Histórica:** Nenhuma base pública de segurança pública reflete a totalidade dos delitos. A interface do usuário deve manter permanentemente a indicação de subnotificação e incentivar o registro de boletins de ocorrência.
3. **Dados Históricos Descontinuados pelo SINESP:** Conforme documentado em `docs/sources/SINESP.md`, o Ministério da Justiça alterou as URLs e formatos em 2023/2024. Apenas datasets validados e catalogados com hashes SHA-256 devem ser aceitos para importações automáticas.
