# Fonte Oficial de Dados: SEJUSP-MG / SSP-MG (Minas Gerais)

## 1. Órgão
- **Órgão Responsável:** Secretaria de Estado de Justiça e Segurança Pública de Minas Gerais (SEJUSP-MG) / Centro Integrado de Comando e Controle (CICC) / Observatório de Segurança Pública / Governo do Estado de Minas Gerais
- **Identificador Canônico no Sistema:** `SSP-MG` (ou `SEJUSP-MG`)
- **Dataset Canônico de Indicadores Municipais:** `indicadores_municipais_mg`
- **Dataset Canônico por Unidade Integrada (RISP/AISP):** `indicadores_risp_mg`

## 2. URL Oficial
- **Portal Oficial da SEJUSP:** `https://www.seguranca.mg.gov.br/`
- **Portal de Dados Abertos de Minas Gerais:** `http://dados.mg.gov.br/`
- **Catálogo Oficial de Segurança Pública:** `http://dados.mg.gov.br/dataset/estatisticas-seguranca-publica-municipios`

## 3. Dataset e Formato
- **Arquivos Primários:**
  1. `Estatisticas_Seguranca_Publica_MG_Mensal.csv`: Dados de ocorrências e vítimas consolidados mensalmente para os 853 municípios do estado de Minas Gerais.
  2. `Estatisticas_Criminais_RISP_Mensal.csv`: Dados desagregados por Região Integrada de Segurança Pública (RISP) e Áreas Integradas (AISP).
- **Formato Estrutural:**
  - **Estrutura Vertical (Padrão Dados Abertos MG):** Linhas contendo `codigo_ibge`, `municipio`, `natureza`/`fato`, `ano`, `mes`, `registros`/`qtde_ocorrencias`, `vitimas`.
  - **Estrutura Matricial (Wide):** Colunas com código IBGE, município, período e contadores de crimes (`homicidio_consumado`, `homicidio_tentado`, `latrocinio`, `estupro_consumado`, `roubo_consumado`, `furto_consumado`, `roubo_veiculo`, `furto_veiculo`, `roubo_carga`, etc.).
- **Delimitadores:** Ponto e vírgula (`;`) ou vírgula (`,`), codificação UTF-8 ou ISO-8859-1 (Latin1).

## 4. Periodicidade
- **Publicação:** Mensal.
- **Janela de Atualização:** Consolidado e publicado oficialmente entre o 20º e o 28º dia do mês subsequente.
- **Histórico Disponível:** Séries mensais estruturadas desde 2012 até o ano corrente.

## 5. Cobertura
- **Unidade Federativa:** Minas Gerais (MG).
- **Extensão Territorial:** Todos os 853 municípios mineiros (100% de cobertura do território estadual).
- **Divisões de Segurança:** 19 RISP (Regiões Integradas de Segurança Pública), cobrindo da 1ª RISP (Belo Horizonte) até as RISPs do Triângulo, Norte, Sul e Zona da Mata.

## 6. Granularidade
- **Nível 1 (Municipal):** Identificado por Código IBGE de 7 dígitos (`codigo_ibge` / `cod_ibge` / `ibge`) e Nome do Município (`municipio`).
- **Nível 2 (Regional):** Identificado por Número/Nome da RISP (`risp`) e AISP (`aisp`).

## 7. Campos do Dataset Oficial

| Campo Original SEJUSP | Descrição | Tipo | Exemplo |
|---|---|---|---|
| `codigo_ibge` / `cod_ibge` | Código IBGE do Município (7 dígitos) | Integer / String | `3106200` (Belo Horizonte), `3170206` (Uberlândia) |
| `municipio` / `nome_municipio` | Nome do Município | String | `Belo Horizonte`, `Uberlândia`, `Juiz de Fora` |
| `risp` | Região Integrada de Segurança Pública | Integer / String | `1` (Belo Horizonte), `9` (Uberlândia) |
| `ano` | Ano de Referência da Ocorrência | Integer | `2024` |
| `mes` | Mês de Referência (1 a 12 ou nome do mês) | Integer / String | `1` ou `Janeiro` |
| `natureza` / `fato` | Tipificação ou Descrição do Crime | String | `Homicídio Consumado`, `Roubo Consumado` |
| `registros` / `qtde_ocorrencias` | Quantidade de Ocorrências / Registros | Integer | `15` |
| `vitimas` | Quantidade de Vítimas (quando aplicável) | Integer | `18` |

## 8. Categorias e Mapeamento Canônico

O adapter `SspMgAdapter` executa a padronização das rubricas mineiras para a taxonomia canônica unificada:

| Rubrica / Coluna SEJUSP-MG | Categoria Canônica | Agrupamento | Unidade |
|---|---|---|---|
| `Homicídio Consumado`, `Latrocínio`, `Lesão Corporal Seguida de Morte` | `homicide` | violent | vitimas / ocorrencias |
| `Homicídio Tentado`, `Lesão Corporal Consumada` | `bodily_harm` | violent | ocorrencias |
| `Estupro Consumado`, `Estupro de Vulnerável Consumado`, `Estupro Tentado` | `sexual_crime` | violent | vitimas / ocorrencias |
| `Roubo de Veículo` | `vehicle_robbery` | vehicle | ocorrencias |
| `Furto de Veículo` | `vehicle_theft` | vehicle | ocorrencias |
| `Roubo de Carga` | `cargo_theft` | property | ocorrencias |
| `Roubo Consumado`, `Roubo a Transeunte`, `Roubo a Estabelecimento Comercial`, `Roubo a Residência`, `Extorsão Mediante Sequestro` | `robbery` | property | ocorrencias |
| `Furto Consumado`, `Furto a Transeunte`, `Outros Furtos` | `theft` | property | ocorrencias |
| `Tráfico de Drogas`, `Uso e Consumo de Drogas`, `Apreensão de Drogas` | `drug_related` | drug | ocorrencias |
| `Armas de Fogo Apreendidas`, `Homicídio Culposo no Trânsito`, `Outros Registros` | `other` | other | ocorrencias / armas |

## 9. Metodologia
- O Observatório de Segurança Pública da SEJUSP compila os dados do REDS (Registro de Eventos de Defesa Social), lavrados conjuntamente pela Polícia Militar de Minas Gerais (PMMG), Polícia Civil de Minas Gerais (PCMG) e Corpo de Bombeiros Militar (CBMMG).
- Os registros passam por auditoria do CICC antes da consolidação e publicação mensal no Portal de Dados Abertos de MG.

## 10. Limitações
1. **Ausência de Microdados de Georreferenciamento:** As tabelas mensais do portal são agregadas por município e mês, não fornecendo latitude/longitude pontual por evento individual.
2. **Defasagem de Divulgação:** Fechamento mensal após validação institucional (20 a 30 dias após o encerramento do mês).
3. **Multiplicidade de Formatos:** Suporte a arquivos no formato vertical (linha por natureza) e formato horizontal (colunas por crime).

## 11. Estratégia de Download
- Ingestão via upload de arquivos no painel administrativo (`/api/admin/pipeline/trigger`).
- Download automatizado pelo `AutoDownloader` apontando para o catálogo de dados abertos do Governo de Minas Gerais (`dados.mg.gov.br`).
- Gravação imediata no armazenamento RAW imutável (`storage/raw/ssp-mg/`) com cálculo de SHA-256 e tamanho em bytes.

## 12. Estratégia de Parsing & Normalização
1. **Sanitização de Cabeçalhos:** Conversão para minúsculas, remoção de acentos e espaços extras.
2. **Quality Gate e Validação de Schema:** Verificação obrigatória da presença de colunas de localização (`codigo_ibge` ou `municipio`), período (`ano`, `mes`) e natureza do crime (`natureza` ou colunas criminais largas).
3. **Resolução de Código IBGE:** Extração direta do código de 7 dígitos do município. Caso ausente, resolução via `GeoNormalizationService` a partir do nome do município (`municipio`).
4. **Normalização Temporal:** Geração da chave canônica `period` no formato `YYYY-MM` (ex: `2024-01`).
5. **Conversão Numérica Segura:** Sanitização de separadores de milhar, valores nulos (`"-"`, `"N/D"`) e conversão para inteiros.
6. **Deduplicação e Idempotência:** Chave determinística `ind_SSP-MG_MG_${muniCode}_${canonicalCategory}_${period}` prevenindo duplicidades em reprocessamentos.

## 13. Matriz de Risco
- **Risco de Duplicidade:** **BAIXO** (garantido por chave determinística no banco).
- **Risco de Quebra de Layout:** **BAIXO** (estrutura estável do portal Dados Abertos MG).
- **Risco de Volumetria:** **BAIXO** (853 municípios x 12 meses x ~15 tipos penais = ~150.000 indicadores/ano, perfeitamente processável em streaming).

## 14. Status
- **Status Operacional:** **OPERATIONAL**
- **Ambiente:** Integrado ao Pipeline Oficial de Ingestão e Suíte de Confiabilidade.
- **Data de Ativação:** 11/09/2026.
