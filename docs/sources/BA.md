# Fonte Oficial de Dados: SSP-BA (Bahia)

## 1. Órgão
- **Órgão Responsável:** Secretaria da Segurança Pública do Estado da Bahia (SSP-BA) / Superintendência de Gestão Integrada da Ação Policial (SIAP) / Coordenação de Estatística e Avaliação Operacional (CEVAL) / Governo do Estado da Bahia
- **Identificador Canônico no Sistema:** `SSP-BA`
- **Dataset Canônico de Indicadores Municipais:** `indicadores_municipais_ba`
- **Dataset Canônico de Relatórios Estatísticos:** `relatorio_estatistico_ssp_ba`

## 2. URL Oficial
- **Portal Oficial da SSP-BA:** `https://www.ssp.ba.gov.br/`
- **Estatísticas e Indicadores Criminais:** `https://www.ssp.ba.gov.br/estatisticas`
- **Portal de Dados Abertos do Estado da Bahia:** `https://dados.ba.gov.br/`

## 3. Dataset e Formato
- **Arquivos Primários:**
  1. `Estatisticas_Criminais_BA_Municipios.csv`: Tabela com indicadores criminais e CVLI consolidados para os 417 municípios baianos.
  2. `Relatorio_Criminal_BA_Mensal_Vertical.csv`: Tabela desdobrada por natureza penal, CVLI e município.
- **Formato Estrutural:**
  - **Formato Matricial (Wide):** Colunas contendo código IBGE (`cod_ibge` / `codigo_ibge`), município (`municipio` / `nome_municipio`), período (`ano`, `mes`) e rubricas criminais (`cvli`, `homicidio_doloso`, `latrocinio`, `feminicidio`, `lesao_morte`, `furto`, `furto_veiculo`, `roubo`, `roubo_veiculo`, `roubo_onibus`, `roubo_comercio`, `estupro`, `trafico_drogas`, `apreensao_armas`).
  - **Formato Vertical:** Linhas com `cod_ibge` / `codigo_ibge`, `municipio`, `natureza`/`crime`/`delito`/`indicador`, `ano`, `mes`, `quantidade`/`total`/`ocorrencias`/`vitimas`.
- **Delimitadores:** Ponto e vírgula (`;`) ou vírgula (`,`), codificação UTF-8 ou ISO-8859-1 (Latin1).

## 4. Periodicidade
- **Publicação:** Mensal consolidada com balanços trimestrais e anuais.
- **Janela de Atualização:** Publicação até o 15º dia útil do mês subsequente após validação pelo CEVAL/SIAP.
- **Histórico Disponível:** Séries consolidadas desde 2012 até o ano corrente.

## 5. Cobertura
- **Unidade Federativa:** Bahia (BA).
- **Extensão Territorial:** Todos os 417 municípios baianos (100% de cobertura do território estadual).
- **Regiões de Segurança:** Regiões Integradas de Segurança Pública (RISP): RISP Baía de Todos os Santos (BTS), RISP Central, RISP Atlântico, RISP Região Metropolitana de Salvador (RMS), RISP Norte (Juazeiro), RISP Sul (Ilhéus/Itabuna), RISP Leste (Feira de Santana), RISP Oeste (Barreiras), RISP Chapada (Itaberaba) e RISP Sudoeste (Vitória da Conquista).

## 6. Granularidade
- **Nível 1 (Municipal):** Identificado por Código IBGE de 7 dígitos (`cod_ibge` / `codigo_ibge`) e Nome do Município (`municipio`).
- **Nível 2 (Regional/AISP):** Identificado por Regiões Integradas (RISP), Áreas Integradas de Segurança Pública (AISP) e Companhias Independentes / Delegacias Territoriais.

## 7. Campos do Dataset Oficial

| Campo Original SSP-BA | Descrição | Tipo | Exemplo |
|---|---|---|---|
| `cod_ibge` / `codigo_ibge` | Código IBGE do Município (7 dígitos) | Integer / String | `2927408` (Salvador), `2910800` (Feira de Santana), `2933307` (Vitória da Conquista) |
| `municipio` / `nome_municipio` | Nome do Município | String | `Salvador`, `Feira de Santana`, `Vitória da Conquista`, `Camaçari`, `Juazeiro` |
| `ano` | Ano de Referência | Integer | `2024` |
| `mes` | Mês de Referência (1 a 12 ou nome por extenso) | Integer / String | `1` ou `Janeiro` |
| `natureza` / `crime` | Descrição da Natureza Penal (no formato vertical) | String | `Homicídio Doloso`, `CVLI`, `Roubo de Veículo` |
| `cvli` | Crimes Violentos Letais Intencionais (Total de mortes violentas) | Integer | `75` |
| `homicidio_doloso` | Vítimas de Homicídio Doloso | Integer | `68` |
| `latrocinio` | Vítimas de Latrocínio (Roubo com Morte) | Integer | `2` |
| `feminicidio` | Vítimas de Feminicídio | Integer | `3` |
| `lesao_morte` | Vítimas de Lesão Corporal Seguida de Morte | Integer | `2` |
| `roubo_veiculo` | Ocorrências de Roubo de Veículo | Integer | `295` |
| `furto_veiculo` | Ocorrências de Furto de Veículo | Integer | `180` |
| `roubo_onibus` / `roubo_coletivo` | Ocorrências de Roubo a Ônibus / Coletivo | Integer | `45` |
| `roubo_comercio` / `roubo_comercial` | Ocorrências de Roubo a Estabelecimento Comercial | Integer | `120` |
| `roubo` / `roubo_geral` | Ocorrências de Roubo Geral / Transeunte | Integer | `1450` |
| `furto` / `furto_geral` | Ocorrências de Furto Geral | Integer | `1820` |
| `estupro` | Ocorrências de Estupro / Estupro de Vulnerável | Integer | `48` |
| `trafico_drogas` | Ocorrências de Tráfico de Drogas | Integer | `260` |
| `apreensao_armas` | Armas de Fogo Apreendidas | Integer | `115` |

## 8. Categorias e Mapeamento Canônico

O adapter `SspBaAdapter` traduz as rubricas criminais baianas para a taxonomia canônica nacional:

| Rubrica / Coluna SSP-BA | Categoria Canônica | Agrupamento | Unidade |
|---|---|---|---|
| `CVLI`, `Crimes Violentos Letais Intencionais`, `Homicídio Doloso`, `Latrocínio`, `Feminicídio`, `Lesão Corporal Seguida de Morte` | `homicide` | violent | vitimas |
| `Tentativa de Homicídio`, `Lesão Corporal Dolosa` | `bodily_harm` | violent | ocorrencias |
| `Estupro`, `Estupro de Vulnerável`, `Tentativa de Estupro` | `sexual_crime` | violent | vitimas / ocorrencias |
| `Roubo de Veículo`, `Roubo de Auto` | `vehicle_robbery` | vehicle | ocorrencias |
| `Furto de Veículo`, `Furto de Auto` | `vehicle_theft` | vehicle | ocorrencias |
| `Roubo de Carga` | `cargo_theft` | property | ocorrencias |
| `Roubo`, `Roubo a Transeunte`, `Roubo a Ônibus`, `Roubo a Coletivo`, `Roubo a Comércio`, `Roubo a Residência`, `Extorsão` | `robbery` | property | ocorrencias |
| `Furto`, `Furto Qualificado`, `Furto Simples` | `theft` | property | ocorrencias |
| `Tráfico de Drogas`, `Posse de Drogas`, `Apreensão de Entorpecentes` | `drug_related` | drug | ocorrencias |
| `Apreensão de Armas`, `Armas de Fogo`, `Estelionato`, `Outros Crimes` | `other` | other | armas / ocorrencias |

## 9. Metodologia
- Os dados estatísticos da SSP-BA são originados do Sistema Integrado de Gestão da Ação Policial (SIGIP/SGP), com dados registrados pela Polícia Civil da Bahia (PCBA), Polícia Militar da Bahia (PMBA) e Departamento de Polícia Técnica (DPT).
- Passam por consolidação técnica e auditoria pela Coordenação de Estatística e Avaliação Operacional (CEVAL) da SIAP.

## 10. Limitações
1. **Consolidação de CVLI:** O indicador consolidado CVLI abrange Homicídio Doloso, Latrocínio, Feminicídio e Lesão Corporal Seguida de Morte.
2. **Dados Agregados:** Séries estatísticas municipais públicas agregam totais mensais sem microdados de coordenadas georreferenciadas individuais.
3. **Formatos Múltiplos:** Suporte a planilhas matriciais (*wide*) e verticalizadas.

## 11. Estratégia de Download
- Ingestão via upload direto de arquivos no painel administrativo (`/api/admin/pipeline/trigger`).
- Download automatizado via `AutoDownloader` monitorando os balanços estatísticos oficiais da SSP-BA.
- Armazenamento RAW imutável em `storage/raw/ssp-ba/` com hash SHA-256 e bytes calculados.

## 12. Estratégia de Parsing & Normalização
1. **Sanitização de Cabeçalhos:** Conversão para minúsculas, remoção de acentos e caracteres especiais.
2. **Quality Gate:** Validação estrita de colunas geográficas (`cod_ibge` ou `municipio`), período (`ano`, `mes`) e indicadores criminais/CVLI.
3. **Resolução de Código IBGE:** Extração direta do código de 7 dígitos. Se ausente, resolução toponímica via `GeoNormalizationService`.
4. **Normalização Temporal:** Formatação canônica `YYYY-MM`.
5. **Deduplicação e Idempotência:** Chave determinística `ind_SSP-BA_BA_${muniCode}_${canonicalCategory}_${period}` prevenindo duplicidades.

## 13. Matriz de Risco
- **Risco de Duplicidade:** **BAIXO** (garantido por chave determinística no banco).
- **Risco de Quebra de Layout:** **BAIXO** (estrutura consolidada pela CEVAL/SIAP).
- **Risco de Volumetria:** **BAIXO** (417 municípios x 12 meses x ~15 crimes = ~75.000 registros/ano).

## 14. Status
- **Status Operacional:** **OPERATIONAL**
- **Ambiente:** Integrado ao Pipeline Oficial de Ingestão e Suíte de Confiabilidade.
- **Data de Ativação:** 11/09/2026.
