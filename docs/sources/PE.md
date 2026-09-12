# Fonte Oficial de Dados: SDS-PE (Pernambuco)

## 1. Órgão
- **Órgão Responsável:** Secretaria de Defesa Social do Estado de Pernambuco (SDS-PE) / Gerência Geral de Análise Criminal e Estatística (GGACE) / Governo do Estado de Pernambuco
- **Identificador Canônico no Sistema:** `SDS-PE`
- **Dataset Canônico de Indicadores Municipais:** `indicadores_municipais_pe`
- **Dataset Canônico de Relatórios Estatísticos:** `relatorio_estatistico_sds_pe`

## 2. URL Oficial
- **Portal Oficial da SDS-PE:** `https://www.sds.pe.gov.br/`
- **Estatísticas e Indicadores Criminais:** `https://www.sds.pe.gov.br/estatisticas`
- **Portal de Dados Abertos de Pernambuco:** `https://dados.pe.gov.br/`

## 3. Dataset e Formato
- **Arquivos Primários:**
  1. `Estatisticas_Criminais_PE_Municipios.csv`: Tabela com indicadores criminais municipais com ênfase em CVLI (*Crimes Violentos Letais Intencionais*), CVP (*Crimes Violentos contra o Patrimônio*), CVP Veículos, Estupro, Tráfico de Drogas e Apreensão de Armas para os 185 municípios pernambucanos + Distrito Estadual de Fernando de Noronha.
  2. `Relatorio_Criminal_PE_Mensal_Vertical.csv`: Tabela desdobrada por natureza criminal, modalidade e município.
- **Formato Estrutural:**
  - **Formato Matricial (Wide):** Colunas contendo código IBGE (`cod_ibge` / `codigo_ibge` / `ibge`), município (`municipio` / `nome_municipio` / `cidade`), período (`ano`, `mes` / `periodo`) e rubricas criminais (`cvli`, `homicidio_doloso`, `latrocinio`, `feminicidio`, `lesao_morte`, `cvp`, `cvp_transeunte`, `cvp_coletivo`, `cvp_veiculo`, `roubo_veiculo`, `furto_veiculo`, `roubo_carga`, `furto`, `estupro`, `trafico_drogas`, `apreensao_armas`).
  - **Formato Vertical:** Linhas com `cod_ibge` / `municipio`, `natureza`/`crime`/`delito`/`indicador`, `ano`, `mes`, `quantidade`/`total`/`ocorrencias`/`vitimas`.
- **Delimitadores:** Ponto e vírgula (`;`) ou vírgula (`,`), codificação UTF-8 ou ISO-8859-1 (Latin1).

## 4. Periodicidade
- **Publicação:** Mensal consolidada com balanços trimestrais e anuais.
- **Janela de Atualização:** Publicação até o 15º dia útil do mês subsequente após homologação pela GGACE.
- **Histórico Disponível:** Séries consolidadas desde 2012 até o ano corrente.

## 5. Cobertura
- **Unidade Federativa:** Pernambuco (PE).
- **Extensão Territorial:** Todos os 185 municípios pernambucanos e o Distrito Estadual de Fernando de Noronha (100% de cobertura do território estadual).
- **Regiões de Segurança:** Diretoria Integrada Metropolitana (DIM), Diretoria Integrada do Interior I (Dinter I - Agreste/Zona da Mata), Diretoria Integrada do Interior II (Dinter II - Sertão), divididas em Áreas Integradas de Segurança (AIS 01 a AIS 26).

## 6. Granularidade
- **Nível 1 (Municipal):** Identificado por Código IBGE de 7 dígitos (`cod_ibge` / `codigo_ibge`) e Nome do Município (`municipio`).
- **Nível 2 (Regional/AIS):** Identificado por Áreas Integradas de Segurança (AIS), Regiões de Desenvolvimento (RMR, Agreste, Mata Norte, Mata Sul, Sertão do Moxotó, Sertão do Pajeú, Sertão do São Francisco, etc.) e Batalhões/Delegacias Seccionais.

## 7. Campos do Dataset Oficial

| Campo Original SDS-PE | Descrição | Tipo | Exemplo |
|---|---|---|---|
| `cod_ibge` / `codigo_ibge` | Código IBGE do Município (7 dígitos) | Integer / String | `2611606` (Recife), `2607901` (Jaboatão dos Guararapes), `2609600` (Olinda), `2604106` (Caruaru), `2611101` (Petrolina) |
| `municipio` / `nome_municipio` | Nome do Município | String | `Recife`, `Jaboatão dos Guararapes`, `Olinda`, `Caruaru`, `Petrolina`, `Paulista`, `Cabo de Santo Agostinho` |
| `ano` | Ano de Referência | Integer | `2024` |
| `mes` | Mês de Referência (1 a 12 ou nome por extenso) | Integer / String | `1` ou `Janeiro` |
| `natureza` / `crime` | Descrição da Natureza Penal (no formato vertical) | String | `CVLI`, `CVP`, `Homicídio Doloso`, `Roubo de Veículo`, `Estupro` |
| `cvli` | Crimes Violentos Letais Intencionais (Total de mortes violentas intencionais) | Integer | `45` |
| `homicidio_doloso` | Vítimas de Homicídio Doloso | Integer | `40` |
| `latrocinio` | Vítimas de Latrocínio (Roubo seguido de Morte) | Integer | `2` |
| `feminicidio` | Vítimas de Feminicídio | Integer | `2` |
| `lesao_morte` | Vítimas de Lesão Corporal Seguida de Morte | Integer | `1` |
| `cvp` / `cvp_total` | Crimes Violentos contra o Patrimônio (Total de Roubos / CVP) | Integer | `820` |
| `cvp_veiculo` / `roubo_veiculo` | Ocorrências de Roubo de Veículo | Integer | `160` |
| `furto_veiculo` | Ocorrências de Furto de Veículo | Integer | `90` |
| `cvp_coletivo` / `roubo_onibus` | Ocorrências de Roubo a Coletivo / Ônibus | Integer | `35` |
| `cvp_transeunte` / `roubo_transeunte` | Ocorrências de Roubo a Transeunte | Integer | `550` |
| `roubo_carga` / `cvp_carga` | Ocorrências de Roubo de Carga | Integer | `12` |
| `furto` / `furto_geral` | Ocorrências de Furto Geral | Integer | `950` |
| `estupro` | Vítimas de Estupro e Estupro de Vulnerável | Integer | `28` |
| `trafico_drogas` | Ocorrências de Tráfico de Entorpecentes | Integer | `140` |
| `apreensao_armas` | Armas de Fogo Apreendidas | Integer | `65` |

## 8. Mapeamento Taxonômico Canônico

```typescript
const PE_CRIME_MAPPINGS = {
  // Mortes Violentas (CVLI)
  'cvli': { category: 'homicide', subcategory: 'cvli', unit: 'vitimas' },
  'crimes violentos letais intencionais': { category: 'homicide', subcategory: 'cvli', unit: 'vitimas' },
  'homicidio doloso': { category: 'homicide', subcategory: 'homicidio_doloso', unit: 'vitimas' },
  'latrocinio': { category: 'homicide', subcategory: 'latrocinio', unit: 'vitimas' },
  'feminicidio': { category: 'homicide', subcategory: 'feminicidio', unit: 'vitimas' },
  'lesao corporal seguida de morte': { category: 'homicide', subcategory: 'lesao_corporal_morte', unit: 'vitimas' },

  // Crimes contra o Patrimônio (CVP / Roubos e Furtos)
  'cvp': { category: 'robbery', subcategory: 'cvp_geral', unit: 'ocorrencias' },
  'crimes violentos contra o patrimonio': { category: 'robbery', subcategory: 'cvp_geral', unit: 'ocorrencias' },
  'cvp veiculo': { category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  'roubo de veiculo': { category: 'vehicle_robbery', subcategory: 'roubo_veiculo', unit: 'ocorrencias' },
  'furto de veiculo': { category: 'vehicle_theft', subcategory: 'furto_veiculo', unit: 'ocorrencias' },
  'roubo a coletivo': { category: 'robbery', subcategory: 'roubo_onibus', unit: 'ocorrencias' },
  'roubo a transeunte': { category: 'robbery', subcategory: 'roubo_transeunte', unit: 'ocorrencias' },
  'roubo de carga': { category: 'cargo_theft', subcategory: 'roubo_carga', unit: 'ocorrencias' },
  'furto': { category: 'theft', subcategory: 'furto_geral', unit: 'ocorrencias' },

  // Dignidade Sexual
  'estupro': { category: 'sexual_crime', subcategory: 'estupro', unit: 'vitimas' },
  'estupro de vulneravel': { category: 'sexual_crime', subcategory: 'estupro_vulneravel', unit: 'vitimas' },

  // Drogas e Armas
  'trafico de drogas': { category: 'drug_related', subcategory: 'trafico_drogas', unit: 'ocorrencias' },
  'apreensao de armas': { category: 'other', subcategory: 'armas_apreendidas', unit: 'armas' }
};
```

## 9. Limitações e Regras de Negócio
1. **CVLI vs Homicídio Doloso:** A SDS-PE consolidou historicamente o conceito pioneiro de **CVLI** no Pacto pela Vida, somando homicídios dolosos, latrocínios e lesões corporais seguidas de morte.
2. **CVP (Crimes Violentos contra o Patrimônio):** Engloba todas as modalidades de roubo com violência ou grave ameaça (transeunte, comércio, residência, coletivo, veículo e carga).
3. **Mapeamento de Fernando de Noronha:** O Distrito Estadual de Fernando de Noronha possui código IBGE específico (`2605459`) e é integralmente auditado.
