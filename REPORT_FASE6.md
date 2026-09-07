# Relatório Final - Fase 6

## Arquitetura
- **Camada Consolidada:** O cálculo passou de uma rota hardcoded de select para a API `SafetyAnalysisService.ts` que implementa um Proxy Inteligente na hora de analisar, sem sobrescrever ou descaracterizar a natureza do que o Importador leu (`security_occurrences` vs `security_indicators`).
- **Taxonomia:** Implementada `Taxonomy.ts`, versionada em "2.0". Agrupa eventos nativos em 4 clusters padronizados (Violentos, Propriedade, Veículos e Outros).

## Data Quality & Coverage
- Adotamos um Quality Score importado de cada batch (Taxa de acerto `recordsValid / totalRecords`), além de um Score de *Freshness* pautado na defasagem em meses da inserção.
- Quando o usuário faz uma busca, não entregamos "SINESP" cegamente. O `Coverage` alerta se a precisão do resultado provêm de "coordinate" (Lat/Lon) ou "municipality" (Raio ineficaz; fallback pro município todo).

## Consolidation
- Regra de Prioridade: `SourcePriority.ts` determina se o estado possui integração local (`SSP-SP`, `ISP-RJ`, `SSP-MG`). Caso positivo, o `SINESP` é totalmente descartado das métricas locais via `WHERE source_id`, matando o risco de sobreposição e dupla contagem (que historicamente inflava números somando "Homicídio Estadual" + "Homicídio Nacional" sobre a mesma cidade).

## Confidence
- Fórmula que varia de 0.0 a 1.0 (apresentada no painel web como 0-100%).
- `(GeographicCoverage * 0.4) + (QualityScore * 0.4) + (Freshness * 0.2)`.

## Safety Score (Nova Metodologia)
- O `/5` aleatório sumiu.
- Se o nível é coordenada, lidamos com Ocorrências Ponderadas por `Km²` anualizadas.
- Se o nível é municipal (Ex: Juiz de Fora - MG), lidamos com Ocorrências Ponderadas por `100 mil habitantes`, utilizando o baseline do Censo do IBGE pré-cadastrado no cache.
- Se zero resultados, ele recusa cuspir `Score: 100`, engatilhando um bloqueio visual de Status `Dados Insuficientes`, ensinando o usuário sobre a limitação do inventário nacional.

## Frontend
- Adaptado para exibir `Confiança`, `Cobertura Geográfica` e o `Nível (Granularidade)`.
- Adicionado Índice de Qualidade na lista de fontes e Data de Atualização baseada no tracking dos Imports originais de Fase 3 e 4.

## Pendências (Status)
- **IMPLEMENTADO:** Engine Consolidada Híbrida (`SafetyAnalysisService.ts`), Nova API, Cálculo Demográfico 100k, Taxonomia Canônica, Módulo Confidence.
- **VALIDADO:** Prevenção de Dupla-Contagem com Fallback SINESP, Invalidação de Zero-Data.
- **PENDENTE (Futuro):** Implementação de Trend Models em Séries Temporais avançadas e Dashboard de ADM Data Quality persistente na UI do Admin (por ora só rastreáveis via métricas de importação da Fase 4).
