# Qualidade de Dados (Data Quality)

O projeto Vizinhança instituiu a partir da Fase 6 um framework de avaliação contínua da qualidade do acervo ingerido:

## Quality Score
- **Fórmula Base:** `recordsValid / totalRecords` (calculado no momento em que o Import Job finaliza a extração).
- Essa métrica mede diretamente o *Completeness* e *Validity* do CSV cru. Se o SINESP mandar linhas vazias, a Qualidade decresce, mitigando a Confiança (Confidence) do Score de Segurança daquela cidade.

## Freshness
- Avalia a "frescura" dos dados perante o calendário atual.
- Fonte importada e atualizada no mês corrente possui peso `1.0`. Bases abandonadas perdem relevância linearmente, atingindo `0.0` se superarem 12 meses de defasagem, empurrando o Score final de Confiança para as margens de erro (Atenção moderada ou Dados Insuficientes).

## Estabilidade (Uniqueness / Consistency)
- A idempotência construída pela `Version` no pipeline de ingestão e as *Primary Keys* do Drizzle ORM (Constraint nas colunas: `source_id, state_code, municipality_code, category, period`) anulam por design a duplicação dos agregados.
- Na base de ocorrências coordenadas, criamos um ID Sintético ou mapeamos o ID do BO nativo, barrando *inserts* duplicados.
