# Metodologia Vizinhança (v2.0)

A partir da Fase 6, a plataforma Vizinhança abandonou a contagem bruta em raio baseada apenas em coordenadas ("densidade burra") para introduzir um modelo consolidador dinâmico. 

## 1. Mapeamento
SOURCE -> DATASET -> IMPORT -> RAW DATA -> NORMALIZED DATA -> OCCURRENCE / INDICATOR -> QUALITY -> COVERAGE -> CONSOLIDATION -> ANALYSIS -> CONFIDENCE -> SAFETY SCORE

Os dados são armazenados na forma original, com uma coluna `source_category` e sua normalização na coluna `category`.

## 2. Indicadores vs Ocorrências
- `security_occurrences`: Representam pontos lat/lon (Nível 1). Atualmente apenas integrados para SSP-SP (boletins).
- `security_indicators`: Representam agregados por município (Nível 3). Ex: SSP-MG, ISP-RJ, SINESP.
- A Engine sempre escolhe a fonte prioritária do Estado baseado no arquivo `SourcePriority.ts` para evitar dupla contagem. Exemplo: Para MG, descartamos o SINESP e usamos a SSP-MG.

## 3. Resolucao Geográfica e Densidade/População
Se a busca por Raio interceder em um Estado sem Ocorrências mas com Indicadores Municipais, o sistema usa as métricas **municipais**, convertendo a contagem baseada na **População** local do IBGE. Caso haja coordenadas, o sistema realiza os cálculos via **densidade por raio quadrado (área)**.

## 4. Confidence
Nenhum score é garantido como 100% certeiro. Um score "Atenção Baixa" sem dados não é um 0 (Super Seguro), é `insufficient_data`. A Confiança baseia-se em 3 pilares:
- **Cobertura Geográfica (40%):** Ocorrências locais pesam mais que as municipais diluídas no raio.
- **Qualidade do Dado (40%):** Histórico de `recordsValid / totalRecords` calculados na ingestão.
- **Freshness (20%):** Base atualizada mês passado = 1.0; Base há 12 meses = 0.0.
