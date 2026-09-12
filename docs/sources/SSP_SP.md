# Fonte Oficial de Dados: SSP-SP (São Paulo)

## 1. Fonte
- **Órgão Responsável:** Secretaria de Segurança Pública do Estado de São Paulo (SSP-SP)
- **Identificador Canônico:** `SSP-SP`
- **Dataset Canônico de Ocorrências:** `ocorrencias_criminais_sp`
- **Dataset Canônico de Indicadores:** `indicadores_municipais_sp`

## 2. URL Oficial
- **Portal de Transparência da SSP-SP:** `https://www.ssp.sp.gov.br/transparenciassp/`
- **Consulta de Estatísticas:** `https://www.ssp.sp.gov.br/transparenciassp/Consulta.aspx`
- **Dados Abertos e Microdados:** `https://www.ssp.sp.gov.br/estatistica/dados-abertos`

## 3. Formato
A SSP-SP disponibiliza dados em três formatos estruturais distintos:
1. **Microdados de Boletins de Ocorrência (BO):**
   - Formato de arquivo: CSV / TSV delimitado por vírgula ou ponto e vírgula
   - Contém ocorrências pontuais com data, hora, endereço, bairro, delegacia, tipificação da conduta e coordenadas geográficas (latitude/longitude).
2. **Séries Históricas Consolidadas por Município (Horizontal):**
   - Formato de arquivo: CSV / XLS / XLSX
   - Estrutura tabular horizontal contendo colunas de identificação (`Município`, `Natureza`, `Ano`) e colunas separadas para cada mês (`Janeiro` a `Dezembro` ou `Jan` a `Dez`).
3. **Séries Históricas Consolidadas por Município (Vertical):**
   - Formato de arquivo: CSV / XLSX
   - Estrutura vertical onde cada linha representa um registro com colunas `Município`, `Natureza`, `Ano`, `Mês` e `Total` (ou `Valor`/`Ocorrências`).

## 4. Granularidade
- **Microdados de BO:** Pontual / Georreferenciada (nível de endereço, logradouro e coordenadas `lat, lon`)
- **Tabelas Estatísticas:** Municipal / Mensal (por código e nome do município, discriminado por mês e ano)

## 5. Periodicidade
- **Publicação:** Mensal
- **Janela de Atualização:** Publicado oficialmente até o 25º dia útil do mês subsequente ao encerramento do mês de referência.

## 6. Cobertura
- **Unidade Federativa:** São Paulo (SP)
- **Extensão Territorial:** Todos os 645 municípios paulistas.
- **Histórico Disponível:** Dados estatísticos municipais desde 2001; microdados detalhados de BO desde 2018.

## 7. Metodologia
- Os dados são originados do sistema RDO (Registro Digital de Ocorrências) da Polícia Civil e COPOM da Polícia Militar de São Paulo.
- A contagem em estatísticas municipais consolidadas refere-se a **número de vítimas** para Homicídio Doloso, Latrocínio e Lesão Corporal Seguida de Morte, e **número de ocorrências** para crimes contra o patrimônio (roubos, furtos) e estupro.

## 8. Categorias
O adapter `SspSpAdapter` mapeia a totalidade das rubricas da Polícia Civil de SP para a taxonomia canônica nacional:

| Rubrica SSP-SP Original | Categoria Canônica | Agrupamento |
|---|---|---|
| HOMICÍDIO DOLOSO (incl. Feminicídio) | `homicide` | violent |
| LATROCÍNIO (Roubo seguido de morte) | `homicide` | violent |
| LESÃO CORPORAL SEGUIDA DE MORTE | `homicide` | violent |
| TENTATIVA DE HOMICÍDIO | `assault` | violent |
| LESÃO CORPORAL DOLOSA | `bodily_harm` | violent |
| ROUBO DE VEÍCULO | `vehicle_robbery` | vehicle |
| FURTO DE VEÍCULO | `vehicle_theft` | vehicle |
| ROUBO DE CARGA | `cargo_theft` | property |
| ROUBO - OUTROS / ROUBO A BANCO | `robbery` | property |
| FURTO - OUTROS / FURTO | `theft` | property |
| ESTUPRO / ESTUPRO DE VULNERÁVEL | `sexual_crime` | violent |
| TRÁFICO DE ENTORPECENTES / PORTE | `drug_related` | drug |
| DEMAIS OCORRÊNCIAS / NÃO PREVISTAS | `other` | other |

> **Nota de Resiliência:** Rubricas não previstas ou novos tipos penais criados pela legislação não são descartados; são classificados preventivamente como `other`, mantendo o campo `source_category` íntegro para auditoria e retreinamento.

## 9. Limitações
1. **Subnotificação e Atraso:** Casos em apuração ou retificação de boletins de ocorrência podem sofrer alterações no boletim de encerramento mensal.
2. **Abreviações em Nomes de Municípios:** Bases históricas antigas contêm nomes abreviados como `S. Paulo`, `S. Bernardo do Campo`, `Moji Mirim` ou grafias como `Florínea` vs `Florínia`.
3. **Coordenadas Nulas:** Cerca de 15% a 25% dos boletins de ocorrência no portal não contam com latitude e longitude georreferenciadas na origem (geralmente gerados por delegacia eletrônica sem geolocalização no momento do registro).
4. **Separadores Numéricos:** Planilhas exportadas da SSP-SP frequentemente utilizam ponto para separação de milhar (ex: `1.250`) e traço (`-`) ou `N/D` para valores nulos.

## 10. Estratégia de Parsing
O adapter implementa uma máquina de estados e detecção polimórfica:
1. **Sanitização de Headers:** Remoção de acentuação (Unicode NFD), caracteres de controle, trim e uppercase.
2. **Detecção de Schema:**
   - Se possuir identificador de BO (`NUM_BO`) e data (`DATAOCORRENCIA`), direciona para `parseOccurrenceRow`.
   - Se possuir colunas de meses ou coluna `MES` + `TOTAL`, direciona para `parseIndicatorRow`.
3. **Parsing Numérico Resiliente:**
   - Remoção de separador de milhar (`1.250` -> `1250`).
   - Mapeamento de `-`, `.`, `N/D`, `ND`, `S/I` para `0`.
4. **Parsing Temporal:**
   - Extração de data e hora combinadas (`DD/MM/YYYY HH:mm`) gerando UTC Date.
   - Resolução de meses por extenso (`Fevereiro`), abreviados (`Fev`), ou numéricos (`02`).
5. **Normalização Geográfica e Resolução de Aliases:**
   - Dicionário de resolução de nomes históricos da polícia paulista (`Capital`, `S. Paulo`, `S. Bernardo do Campo`, etc.).
   - Resolução de código IBGE de 7 dígitos via `GeoNormalizationService` e `muniCache` pré-carregado no Worker.
6. **Quality Gate:**
   - Validação de coordenadas dentro dos limites do Brasil (`-35` a `+5.5` Lat, `-75` a `-30` Lon).
   - Registros sem coordenadas são contabilizados nas métricas de qualidade (`recordsWithoutCoordinates`) e mantidos sem falhar a importação.
7. **Deduplicação e Idempotência:**
   - Chave de deduplicação em memória: `occ_${sourceId}_${sourceRecordId}` para ocorrências; `ind_${sourceId}_${state}_${mun}_${cat}_${period}` para indicadores.
   - Constraint de unicidade no banco de dados garantindo que reprocessamento de arquivos idênticos não altere os totais.

## 11. Última Validação
- **Data da Validação:** 11/09/2026
- **Status:** **APROVADO (38/38 asserções automatizadas com 100% de sucesso)**
- **Suíte de Teste:** `tests/ssp-sp-audit.ts`
- **Resultados Chave:**
  - Microdados BO: 11 registros lidos, 10 inseridos, 1 duplicata evitada, 1 registro sem coordenadas auditado no Quality Gate.
  - Indicadores Horizontais: 60 indicadores mensais persistidos e indexados.
  - Indicadores Verticais: 6 indicadores mensais persistidos.
  - Reprocessamento: 100% idempotente (contagem final de ocorrências permaneceu exatamente idêntica).
  - Consulta Pública: Dados consultáveis via `/api/public/v1/indicators` e espacialmente no mapa `/api/analysis`.

## 12. Exemplos de Arquivos
- `tests/fixtures/ssp/ssp_sp_bo_real.csv` (Microdados reais de boletins de ocorrência)
- `tests/fixtures/ssp/ssp_sp_indicadores_horizontal.csv` (Série estatística municipal horizontal)
- `tests/fixtures/ssp/ssp_sp_indicadores_vertical.csv` (Série estatística municipal vertical)
- `tests/fixtures/ssp/ssp_sp_corrupted_schema.csv` (Fixture de teste de rejeição de schema inválido)

## 13. Status de Automação
- **Ingestão Manual via Upload:** Operacional (`/api/admin/upload-ssp` ou `/api/ingestion/upload`)
- **Armazenamento RAW:** Operacional via `RawStorage` com hashing SHA-256
- **Worker Desacoplado:** Operacional com processamento em lote (Batch de 1000) e salvamento de checkpoint
- **Invalidação de Cache:** Ativa via `analysisCache.clear()` pós-persistência
- **Agendador (Scheduler):** Integrado via `AutoDownloader` e `globalScheduler` configurado para varredura periódica
