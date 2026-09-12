# Fonte Oficial de Dados: SESP-PR (Paraná)

## 1. Órgão
- **Órgão Responsável:** Secretaria de Estado da Segurança Pública do Paraná (SESP-PR) / Centro de Análise, Planejamento e Estatística (CAPE) / Governo do Estado do Paraná
- **Identificador Canônico no Sistema:** `SESP-PR`
- **Dataset Canônico de Indicadores Municipais:** `indicadores_municipais_pr`
- **Dataset Canônico de Relatórios Estatísticos:** `relatorio_estatistico_sesp_pr`

## 2. URL Oficial
- **Portal Oficial da SESP-PR:** `https://www.seguranca.pr.gov.br/`
- **Estatísticas e Relatórios de Segurança:** `https://www.seguranca.pr.gov.br/Estatisticas`
- **Portal de Dados Abertos do Paraná:** `https://www.dados.pr.gov.br/`

## 3. Dataset e Formato
- **Arquivos Primários:**
  1. `Estatisticas_Criminais_PR_Municipios.csv`: Tabela consolidada com indicadores criminais para os 399 municípios paranaenses.
  2. `Relatorio_Criminal_PR_Mensal_Vertical.csv`: Tabela desdobrada por natureza/fato penal e município.
- **Formato Estrutural:**
  - **Formato Matricial (Wide):** Colunas contendo código IBGE (`cod_ibge` / `codigo_ibge`), município (`municipio`), período (`ano`, `mes`) e rubricas criminais (`homicidio_doloso`, `latrocinio`, `feminicidio`, `furto`, `furto_veiculo`, `roubo`, `roubo_veiculo`, `estupro`, `trafico_drogas`, `apreensao_armas`).
  - **Formato Vertical:** Linhas com `codigo_ibge`, `municipio`, `natureza`/`indicador`, `ano`, `mes`, `quantidade`/`total`/`vitimas`.
- **Delimitadores:** Ponto e vírgula (`;`) ou vírgula (`,`), codificação UTF-8 ou ISO-8859-1 (Latin1).

## 4. Periodicidade
- **Publicação:** Mensal / Trimestral consolidada.
- **Janela de Atualização:** Publicação até o final do mês subsequente ao fechamento do período pelo CAPE.
- **Histórico Disponível:** Séries consolidadas desde 2015 até o ano corrente.

## 5. Cobertura
- **Unidade Federativa:** Paraná (PR).
- **Extensão Territorial:** Todos os 399 municípios paranaenses (100% de cobertura do território estadual).
- **Regiões de Segurança:** 1º CRPM (Curitiba), 2º CRPM (Londrina/Norte), 3º CRPM (Maringá/Noroeste), 4º CRPM (Ponta Grossa/Campos Gerais), 5º CRPM (Cascavel/Foz/Oeste) e 6º CRPM (São José dos Pinhais/RMC/Litoral).

## 6. Granularidade
- **Nível 1 (Municipal):** Identificado por Código IBGE de 7 dígitos (`cod_ibge` / `codigo_ibge`) e Nome do Município (`municipio`).
- **Nível 2 (Regional/AISP):** Identificado por Área Integrada de Segurança Pública (AISP) e Regiões Policiais da Polícia Civil e Polícia Militar do Paraná.

## 7. Campos do Dataset Oficial

| Campo Original SESP-PR | Descrição | Tipo | Exemplo |
|---|---|---|---|
| `cod_ibge` / `codigo_ibge` | Código IBGE do Município (7 dígitos) | Integer / String | `4106902` (Curitiba), `4113700` (Londrina), `4115200` (Maringá) |
| `municipio` / `nome_municipio` | Nome do Município | String | `Curitiba`, `Londrina`, `Maringá`, `Ponta Grossa`, `Cascavel` |
| `ano` | Ano de Referência | Integer | `2024` |
| `mes` | Mês de Referência (1 a 12 ou nome do mês) | Integer / String | `1` ou `Janeiro` |
| `natureza` / `indicador` | Descrição da Natureza Penal (no formato vertical) | String | `Homicídio Doloso`, `Roubo de Veículo` |
| `homicidio_doloso` | Vítimas de Homicídio Doloso | Integer | `15` |
| `latrocinio` | Vítimas de Latrocínio (Roubo com Morte) | Integer | `1` |
| `feminicidio` | Vítimas de Feminicídio | Integer | `2` |
| `roubo_veiculo` | Ocorrências de Roubo de Veículo | Integer | `85` |
| `furto_veiculo` | Ocorrências de Furto de Veículo | Integer | `140` |
| `roubo` / `roubo_geral` | Ocorrências de Roubo Geral / Transeunte | Integer | `620` |
| `furto` / `furto_geral` | Ocorrências de Furto Geral | Integer | `1450` |
| `estupro` | Ocorrências de Estupro / Estupro de Vulnerável | Integer | `28` |
| `trafico_drogas` | Ocorrências de Tráfico de Drogas | Integer | `195` |

## 8. Categorias e Mapeamento Canônico

O adapter `SespPrAdapter` traduz as rubricas criminais paranaenses para a taxonomia canônica nacional:

| Rubrica / Coluna SESP-PR | Categoria Canônica | Agrupamento | Unidade |
|---|---|---|---|
| `Homicídio Doloso`, `Latrocínio`, `Feminicídio`, `Lesão Corporal Seguida de Morte` | `homicide` | violent | vitimas |
| `Homicídio Tentado`, `Lesão Corporal Dolosa` | `bodily_harm` | violent | ocorrencias |
| `Estupro`, `Estupro de Vulnerável`, `Tentativa de Estupro` | `sexual_crime` | violent | vitimas / ocorrencias |
| `Roubo de Veículo` | `vehicle_robbery` | vehicle | ocorrencias |
| `Furto de Veículo` | `vehicle_theft` | vehicle | ocorrencias |
| `Roubo de Carga` | `cargo_theft` | property | ocorrencias |
| `Roubo`, `Roubo a Transeunte`, `Roubo a Comércio`, `Roubo a Residência`, `Extorsão` | `robbery` | property | ocorrencias |
| `Furto`, `Furto Qualificado`, `Furto Simples` | `theft` | property | ocorrencias |
| `Tráfico de Drogas`, `Posse/Uso de Drogas`, `Apreensão de Entorpecentes` | `drug_related` | drug | ocorrencias |
| `Apreensão de Armas de Fogo`, `Estelionato`, `Outras Ocorrências` | `other` | other | ocorrencias |

## 9. Metodologia
- Os dados estatísticos da SESP-PR são consolidados a partir do Boletim de Ocorrência Unificado (BOU), gerado pelas delegacias da Polícia Civil e unidades da Polícia Militar do Paraná.
- Passam por auditoria e validação técnica do Centro de Análise, Planejamento e Estatística (CAPE).

## 10. Limitações
1. **Consolidação Periódica:** Relatórios estatísticos podem sofrer revisões no fechamento quadrimestral pelo CAPE.
2. **Dados Agregados:** Séries públicas são agregadas por município e mês/trimestre, sem coordenadas de microdados individuais.
3. **Múltiplos Formatos:** Suporte a planilhas matriciais (*wide*) e verticalizadas.

## 11. Estratégia de Download
- Ingestão via upload de arquivos no painel administrativo (`/api/admin/pipeline/trigger`).
- Download automatizado via `AutoDownloader` apontando para os repositórios oficiais da SESP-PR.
- Armazenamento RAW imutável em `storage/raw/sesp-pr/` com hash SHA-256 e bytes.

## 12. Estratégia de Parsing & Normalização
1. **Sanitização de Cabeçalhos:** Conversão para minúsculas, remoção de acentos e caracteres especiais.
2. **Quality Gate:** Validação estrita de colunas geográficas (`cod_ibge` ou `municipio`), período (`ano`, `mes`) e indicadores criminais.
3. **Resolução de Código IBGE:** Extração direta do código de 7 dígitos. Se ausente, resolução toponímica via `GeoNormalizationService`.
4. **Normalização Temporal:** Formatação canônica `YYYY-MM`.
5. **Deduplicação e Idempotência:** Chave determinística `ind_SESP-PR_PR_${muniCode}_${canonicalCategory}_${period}` prevenindo duplicações.

## 13. Matriz de Risco
- **Risco de Duplicidade:** **BAIXO** (garantido por chave determinística no banco).
- **Risco de Quebra de Layout:** **BAIXO** (estrutura consolidada pelo CAPE).
- **Risco de Volumetria:** **BAIXO** (399 municípios x 12 meses x ~15 crimes = ~72.000 registros/ano).

## 14. Status
- **Status Operacional:** **OPERATIONAL**
- **Ambiente:** Integrado ao Pipeline Oficial de Ingestão e Suíte de Confiabilidade.
- **Data de Ativação:** 11/09/2026.
