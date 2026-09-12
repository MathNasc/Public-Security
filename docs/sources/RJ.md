# Fonte Oficial de Dados: ISP-RJ (Rio de Janeiro)

## 1. Órgão
- **Órgão Responsável:** Instituto de Segurança Pública do Estado do Rio de Janeiro (ISP-RJ) / Secretaria de Estado de Polícia Civil (SEPOL-RJ) / Governo do Estado do Rio de Janeiro
- **Identificador Canônico no Sistema:** `ISP-RJ`
- **Dataset Canônico de Indicadores Municipais:** `indicadores_municipais_rj`
- **Dataset Canônico de Indicadores por CISP/DP:** `indicadores_dp_rj`

## 2. URL Oficial
- **Portal Oficial do ISP:** `https://www.isp.rj.gov.br/`
- **Portal de Dados Abertos ISP Dados:** `http://www.ispdados.rj.gov.br/`
- **Repositório de Séries Históricas:** `http://www.ispdados.rj.gov.br/Arquivos/BaseMunicipioMensal.csv` e `http://www.ispdados.rj.gov.br/Arquivos/BaseDPMensal.csv`

## 3. Dataset e Formato
- **Arquivos Primários:**
  1. `BaseMunicipioMensal.csv`: Dados consolidados mensalmente para os 92 municípios do estado do RJ.
  2. `BaseDPMensal.csv`: Dados consolidados mensalmente por Delegacia de Polícia (CISP) e Área Integrada de Segurança Pública (AISP).
- **Formato Estrutural:** CSV delimitado por ponto e vírgula (`;`) ou vírgula (`,`), codificação UTF-8 ou ISO-8859-1.
- **Estrutura Tabular:** Formato largo (*wide*), onde as colunas iniciais identificam a localização e período (`fmun`, `munic`, `ano`, `mes`) e cada tipo penal/rubrica compõe uma coluna específica de contagem (`hom_doloso`, `latrocinio`, `roubo_veiculo`, `furto_veiculos`, `roubo_carga`, etc.).

## 4. Periodicidade
- **Publicação:** Mensal.
- **Janela de Atualização:** Publicado oficialmente entre o 15º e o 20º dia do mês subsequente ao mês apurado.
- **Histórico Disponível:** Séries mensais ininterruptas desde 2003 até o ano corrente.

## 5. Cobertura
- **Unidade Federativa:** Rio de Janeiro (RJ).
- **Extensão Territorial:** Todos os 92 municípios fluminenses (100% de cobertura do território estadual).
- **Divisões de Segurança:** 39 AISP (Áreas Integradas de Segurança Pública), 7 RISP (Regiões Integradas) e mais de 130 CISP (Circunscrições Integradas / Delegacias de Polícia).

## 6. Granularidade
- **Nível 1 (Municipal):** Identificado por Código IBGE de 7 dígitos (`fmun` / `fmun_cod`) e Nome do Município (`munic`).
- **Nível 2 (Circunscrição / Delegacia):** Identificado por Código da CISP (`cisp`), AISP (`aisp`) e RISP (`risp`).

## 7. Campos do Dataset Oficial

| Campo Original ISP | Descrição | Tipo | Exemplo |
|---|---|---|---|
| `fmun` / `fmun_cod` | Código IBGE do Município (7 dígitos) | Integer / String | `3304557` (Rio de Janeiro) |
| `munic` / `municipio` | Nome do Município | String | `Rio de Janeiro`, `Niterói`, `Petrópolis` |
| `cisp` | Código da Delegacia de Polícia / CISP | Integer / String | `005` (5ª DP - Mem de Sá) |
| `aisp` | Área Integrada de Segurança Pública | Integer / String | `04` |
| `risp` | Região Integrada de Segurança Pública | Integer / String | `1` |
| `ano` | Ano de Referência da Ocorrência | Integer | `2024` |
| `mes` | Mês de Referência (1 a 12) | Integer | `3` |
| `hom_doloso` | Homicídio Doloso (incl. Feminicídio) | Integer | `80` |
| `latrocinio` | Roubo Seguido de Morte | Integer | `3` |
| `hom_culposo` | Homicídio Culposo (Trânsito e Outros) | Integer | `45` |
| `lesao_corp_morte` | Lesão Corporal Seguida de Morte | Integer | `2` |
| `letalidade_violenta` | Somatório de Crimes Violentos Letais | Integer | `85` |
| `tentat_hom` | Tentativa de Homicídio | Integer | `110` |
| `lesao_corp_dolosa` | Lesão Corporal Dolosa | Integer | `350` |
| `estupro` | Estupro e Estupro de Vulnerável | Integer | `90` |
| `roubo_transeunte` | Roubo a Transeunte (Pedestres) | Integer | `1200` |
| `roubo_celular` | Roubo de Aparelho Celular | Integer | `850` |
| `roubo_veiculo` | Roubo de Veículo | Integer | `600` |
| `furto_veiculos` | Furto de Veículo | Integer | `300` |
| `roubo_carga` | Roubo de Carga | Integer | `120` |
| `roubo_comercio` | Roubo a Estabelecimento Comercial | Integer | `180` |
| `roubo_residencia` | Roubo a Residência | Integer | `45` |
| `roubo_banco` | Roubo a Instituição Financeira / Caixa | Integer | `1` |
| `roubo_conducao` / `roubo_coletivo` | Roubo em Transporte Coletivo | Integer | `240` |
| `sequestro` / `sequestro_relampago` | Extorsão Mediante Sequestro / Relâmpago | Integer | `5` |
| `extorsao` | Extorsão | Integer | `80` |
| `furto_transeunte` | Furto a Transeunte | Integer | `400` |
| `furto_celular` | Furto de Celular | Integer | `620` |
| `furto_bicicleta` | Furto de Bicicleta | Integer | `75` |
| `outros_furtos` | Demais Furtos | Integer | `1100` |
| `apreensoes_drogas` / `registro_drogas` | Ocorrências com Apreensão de Drogas | Integer | `520` |
| `posse_drogas` | Posse ou Uso de Entorpecentes | Integer | `180` |
| `trafico_drogas` | Tráfico de Entorpecentes | Integer | `340` |
| `armas_apreendidas` | Total de Armas de Fogo Apreendidas | Integer | `210` |
| `registro_ocorrencias` | Total Geral de Registros de Ocorrência | Integer | `8500` |

## 8. Categorias e Mapeamento Canônico

O adapter `IspRjAdapter` executa o unpivot (*desdobramento*) das colunas de crimes para a taxonomia canônica unificada da plataforma:

| Coluna ISP-RJ | Categoria Canônica | Agrupamento | Unidade |
|---|---|---|---|
| `hom_doloso`, `latrocinio`, `lesao_corp_morte`, `letalidade_violenta` | `homicide` | violent | ocorrencias / vitimas |
| `tentat_hom`, `lesao_corp_dolosa` | `bodily_harm` | violent | ocorrencias |
| `estupro` | `sexual_crime` | violent | ocorrencias / vitimas |
| `roubo_veiculo` | `vehicle_robbery` | vehicle | ocorrencias |
| `furto_veiculos` | `vehicle_theft` | vehicle | ocorrencias |
| `roubo_carga` | `cargo_theft` | property | ocorrencias |
| `roubo_transeunte`, `roubo_celular`, `roubo_comercio`, `roubo_residencia`, `roubo_banco`, `roubo_conducao`, `roubo_coletivo`, `extorsao`, `sequestro` | `robbery` | property | ocorrencias |
| `furto_transeunte`, `furto_celular`, `furto_bicicleta`, `outros_furtos` | `theft` | property | ocorrencias |
| `apreensoes_drogas`, `registro_drogas`, `posse_drogas`, `trafico_drogas` | `drug_related` | drug | ocorrencias |
| `hom_culposo`, `lesao_corp_culposa`, `armas_apreendidas`, `prisao_mandado`, `registro_ocorrencias` | `other` | other | ocorrencias / armas |

## 9. Metodologia
- Os dados do ISP são compilados diretamente a partir dos Registros de Ocorrência (RO) lavrados em todas as Delegacias de Polícia Civil do Estado do Rio de Janeiro.
- O ISP submete as informações a rotinas estatísticas de controle de qualidade, validação de duplicidades e reclassificação de tipificações antes da consolidação mensal.
- As contagens refletem ocorrências formais registradas pela autoridade policial competente.

## 10. Limitações
1. **Ausência de Microdados de Latitude/Longitude:** As tabelas mensais do ISP são agregadas por município (`BaseMunicipioMensal`) e por delegacia (`BaseDPMensal`), não contendo coordenadas pontuais exatas de logradouro para cada BO individual.
2. **Defasagem de Divulgação:** Ocorrências do mês corrente passam por auditoria do ISP, sendo divulgadas no mês seguinte (defasagem de 15 a 20 dias).
3. **Casos em Investigação:** Reclassificações de inquéritos policiais podem alterar rubricas em publicações históricas subsequentes.
4. **Formato Largo:** Cada linha do CSV original contém até 50 colunas de crimes, exigindo transformação em stream para gerar registros canônicos pontuais de indicadores.

## 11. Estratégia de Download
- Ingestão via upload direto de arquivos oficiais no painel de administração (`/api/admin/pipeline/trigger`).
- Download automatizado em background agendado via `AutoDownloader` apontando para o repositório estável de dados abertos do ISP.
- Validação imediata de hash SHA-256 e gravação no armazenamento RAW imutável (`storage/raw/isp-rj/`).

## 12. Estratégia de Parsing
1. **Sanitização de Cabeçalhos:** Conversão para caixa baixa, remoção de acentos e caracteres de controle.
2. **Quality Gate e Validação de Schema:** Verificação obrigatória da presença de colunas de localização (`fmun` ou `munic` ou `cisp`), período (`ano`, `mes`) e rubricas criminais essenciais (`hom_doloso`, `roubo_veiculo`, etc.).
3. **Resolução de Código IBGE:** Extração direta de `fmun` / `fmun_cod` (7 dígitos). Caso ausente, resolução via `GeoNormalizationService` a partir do nome do município (`munic`).
4. **Normalização Temporal:** Geração da chave canônica `period` no formato `YYYY-MM` (ex: `2024-03`).
5. **Conversão Numérica Segura:** Conversão de valores vazios, `"-"`, `"N/D"` e separadores de milhar para inteiros válidos.
6. **Unpivot e Desdobramento:** Para cada tipo penal com valor `> 0`, gera um registro canônico na tabela `security_indicators` com `state_code = 'RJ'`.
7. **Deduplicação e Idempotência:** Chave determinística `ind_ISP-RJ_RJ_${muniCode}_${canonicalCategory}_${period}` prevenindo duplicidades em reprocessamentos.

## 13. Matriz de Risco
- **Risco de Duplicidade:** **BAIXO** (garantido por índice único e chave determinística no banco).
- **Risco de Quebra de Layout:** **BAIXO** (estrutura da `BaseMunicipioMensal` é mantida estável pelo ISP há mais de uma década).
- **Risco de Volumetria:** **BAIXO** (92 municípios x 12 meses x ~20 tipos penais = ~22.000 indicadores/ano, perfeitamente processável em lotes de streaming).

## 14. Status
- **Status Operacional:** **OPERATIONAL**
- **Ambiente:** Integrado ao Pipeline Oficial de Ingestão e Suíte de Confiabilidade.
- **Data de Ativação:** 11/09/2026.
