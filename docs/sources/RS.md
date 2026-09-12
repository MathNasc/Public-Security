# Fonte Oficial de Dados: SSP-RS (Rio Grande do Sul)

## 1. Órgão
- **Órgão Responsável:** Secretaria da Segurança Pública do Estado do Rio Grande do Sul (SSP-RS) / Divisão de Estatística e Inteligência Policial (DEI) / Governo do Estado do Rio Grande do Sul
- **Identificador Canônico no Sistema:** `SSP-RS`
- **Dataset Canônico de Indicadores Municipais:** `indicadores_municipais_rs`
- **Dataset Canônico de Indicadores Regionais (DPI/DCPM):** `indicadores_regionais_rs`

## 2. URL Oficial
- **Portal Oficial da SSP-RS:** `https://ssp.rs.gov.br/`
- **Painel de Indicadores Criminais:** `https://ssp.rs.gov.br/indicadores-criminais`
- **Portal de Dados Abertos do RS:** `https://dados.rs.gov.br/`

## 3. Dataset e Formato
- **Arquivos Primários:**
  1. `Indicadores_Criminais_RS_Municipios.csv`: Tabela mensal consolidada com indicadores criminais para os 497 municípios gaúchos.
  2. `Indicadores_Criminais_RS_Mensal_Vertical.csv`: Tabela desdobrada por fato/natureza penal e município.
- **Formato Estrutural:**
  - **Formato Matricial (Wide):** Colunas contendo código IBGE (`cod_ibge` / `codigo_ibge`), nome do município (`municipio`), período (`ano`, `mes`) e rubricas criminais (`homicidio_doloso`, `latrocinio`, `feminicidio`, `furto`, `furto_veiculo`, `roubo`, `roubo_veiculo`, `estupro`, `estelionato`, `delitos_armas_municoes`, `posse_entorpecentes`, `trafico_entorpecentes`).
  - **Formato Vertical:** Linhas com `codigo_ibge`, `municipio`, `natureza`/`indicador`, `ano`, `mes`, `total`/`ocorrencias`/`vitimas`.
- **Delimitadores:** Ponto e vírgula (`;`) ou vírgula (`,`), codificação UTF-8 ou ISO-8859-1 (Latin1).

## 4. Periodicidade
- **Publicação:** Mensal.
- **Janela de Atualização:** Fechamento e divulgação oficial até o 15º dia útil do mês subsequente.
- **Histórico Disponível:** Séries consolidadas desde 2012 até o ano corrente.

## 5. Cobertura
- **Unidade Federativa:** Rio Grande do Sul (RS).
- **Extensão Territorial:** Todos os 497 municípios gaúchos (100% de cobertura do território estadual).
- **Regiões Integradas:** Região Metropolitana de Porto Alegre (RMPA), Serra, Vale do Sinos, Sul, Fronteira Oeste, Missões, Planalto e Central.

## 6. Granularidade
- **Nível 1 (Municipal):** Identificado por Código IBGE de 7 dígitos (`cod_ibge` / `codigo_ibge` / `ibge`) e Nome do Município (`municipio`).
- **Nível 2 (Regional):** Identificado por Departamento de Polícia (DPI, DCPM, CRPO da Brigada Militar).

## 7. Campos do Dataset Oficial

| Campo Original SSP-RS | Descrição | Tipo | Exemplo |
|---|---|---|---|
| `cod_ibge` / `codigo_ibge` | Código IBGE do Município (7 dígitos) | Integer / String | `4314902` (Porto Alegre), `4305108` (Caxias do Sul) |
| `municipio` / `nome_municipio` | Nome do Município | String | `Porto Alegre`, `Caxias do Sul`, `Pelotas`, `Canoas` |
| `ano` | Ano de Referência | Integer | `2024` |
| `mes` | Mês de Referência (1 a 12 ou nome do mês) | Integer / String | `1` ou `Janeiro` |
| `natureza` / `indicador` | Descrição do Crime (no formato vertical) | String | `Homicídio Doloso`, `Roubo de Veículo` |
| `homicidio_doloso` | Vítimas de Homicídio Doloso | Integer | `18` |
| `latrocinio` | Vítimas de Latrocínio (Roubo com Morte) | Integer | `1` |
| `feminicidio` | Vítimas de Feminicídio | Integer | `2` |
| `roubo_veiculo` | Ocorrências de Roubo de Veículo | Integer | `145` |
| `furto_veiculo` | Ocorrências de Furto de Veículo | Integer | `210` |
| `roubo` / `roubo_pedestre` | Ocorrências de Roubo a Pedestre / Outros | Integer | `980` |
| `furto` | Ocorrências de Furto Geral | Integer | `1850` |
| `estupro` | Ocorrências de Estupro / Estupro de Vulnerável | Integer | `42` |
| `trafico_entorpecentes` | Ocorrências de Tráfico de Drogas | Integer | `260` |

## 8. Categorias e Mapeamento Canônico

O adapter `SspRsAdapter` traduz as rubricas criminais gaúchas para a taxonomia canônica nacional:

| Rubrica / Coluna SSP-RS | Categoria Canônica | Agrupamento | Unidade |
|---|---|---|---|
| `Homicídio Doloso`, `Latrocínio`, `Feminicídio`, `Lesão Corporal Seguida de Morte` | `homicide` | violent | vitimas |
| `Homicídio Tentado`, `Lesão Corporal` | `bodily_harm` | violent | ocorrencias |
| `Estupro`, `Estupro de Vulnerável`, `Tentativa de Estupro` | `sexual_crime` | violent | vitimas / ocorrencias |
| `Roubo de Veículo` | `vehicle_robbery` | vehicle | ocorrencias |
| `Furto de Veículo` | `vehicle_theft` | vehicle | ocorrencias |
| `Roubo de Carga` | `cargo_theft` | property | ocorrencias |
| `Roubo`, `Roubo a Pedestre`, `Roubo a Estabelecimento Comercial`, `Roubo a Residência`, `Roubo a Transporte Coletivo`, `Extorsão` | `robbery` | property | ocorrencias |
| `Furto`, `Furto Qualificado`, `Abigeato` | `theft` | property | ocorrencias |
| `Tráfico de Entorpecentes`, `Posse de Entorpecentes`, `Apreensão de Drogas` | `drug_related` | drug | ocorrencias |
| `Delitos Relacionados a Armas e Munições`, `Estelionato`, `Outros Crimes` | `other` | other | ocorrencias |

## 9. Metodologia
- Os dados estatísticos da SSP-RS são consolidados pelo Sistema de Informações Policiais (SIP) da Polícia Civil do RS e pelo sistema da Brigada Militar (BM/BMRS).
- Passam por conferência da Divisão de Estatística e Inteligência Policial (DEI) para validação e publicação mensal.

## 10. Limitações
1. **Ausência de Microdados de Coordenadas Pontuais:** As tabelas mensais do portal são agregadas por município e mês, sem coordenadas geográficas individuais.
2. **Defasagem de Divulgação:** Fechamento e auditoria mensal entre 10 e 15 dias após o término do mês.
3. **Multiplicidade de Formatos:** Suporte a arquivos matriciais (colunas de crimes) e verticalizados.

## 11. Estratégia de Download
- Ingestão via upload de arquivos no painel administrativo (`/api/admin/pipeline/trigger`).
- Download automatizado via `AutoDownloader` apontando para o repositório oficial da SSP-RS.
- Armazenamento RAW imutável em `storage/raw/ssp-rs/` com hash SHA-256 e bytes.

## 12. Estratégia de Parsing & Normalização
1. **Sanitização de Cabeçalhos:** Conversão para minúsculas, remoção de acentos e espaços extras.
2. **Quality Gate:** Validação pré-processamento obrigatória de colunas geográficas (`cod_ibge` ou `municipio`), período (`ano`, `mes`) e indicadores criminais.
3. **Resolução de Código IBGE:** Extração direta do código de 7 dígitos do município. Caso ausente, resolução toponímica via `GeoNormalizationService`.
4. **Normalização Temporal:** Formatação canônica `YYYY-MM`.
5. **Deduplicação e Idempotência:** Chave determinística `ind_SSP-RS_RS_${muniCode}_${canonicalCategory}_${period}` prevenindo duplicações.

## 13. Matriz de Risco
- **Risco de Duplicidade:** **BAIXO** (garantido por chave determinística no banco).
- **Risco de Quebra de Layout:** **BAIXO** (estrutura histórica muito estável).
- **Risco de Volumetria:** **BAIXO** (497 municípios x 12 meses x ~15 crimes = ~90.000 registros/ano).

## 14. Status
- **Status Operacional:** **OPERATIONAL**
- **Ambiente:** Integrado ao Pipeline Oficial de Ingestão e Suíte de Confiabilidade.
- **Data de Ativação:** 11/09/2026.
