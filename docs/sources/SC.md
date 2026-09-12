# Fonte Oficial de Dados: SSP-SC (Santa Catarina)

## 1. Órgão
- **Órgão Responsável:** Secretaria de Estado da Segurança Pública de Santa Catarina (SSP-SC) / Colegiado Superior de Segurança Pública e Perícia Oficial / Gerência de Estatística e Análise Criminal (GEAC) / Governo do Estado de Santa Catarina
- **Identificador Canônico no Sistema:** `SSP-SC`
- **Dataset Canônico de Indicadores Municipais:** `indicadores_municipais_sc`
- **Dataset Canônico de Relatórios Estatísticos:** `relatorio_estatistico_ssp_sc`

## 2. URL Oficial
- **Portal Oficial da SSP-SC:** `https://www.ssp.sc.gov.br/`
- **Estatísticas e Indicadores Criminais:** `https://www.ssp.sc.gov.br/estatisticas/`
- **Portal de Dados Abertos do Estado de Santa Catarina:** `https://dados.sc.gov.br/`

## 3. Dataset e Formato
- **Arquivos Primários:**
  1. `Estatisticas_Criminais_SC_Municipios.csv`: Tabela com indicadores criminais consolidados para os 295 municípios catarinenses.
  2. `Relatorio_Criminal_SC_Mensal_Vertical.csv`: Tabela desdobrada por natureza/fato criminal e município.
- **Formato Estrutural:**
  - **Formato Matricial (Wide):** Colunas contendo código IBGE (`cod_ibge` / `codigo_ibge`), município (`municipio` / `nome_municipio`), período (`ano`, `mes`) e rubricas criminais (`homicidio_doloso`, `latrocinio`, `feminicidio`, `lesao_morte`, `furto`, `furto_veiculo`, `roubo`, `roubo_veiculo`, `estupro`, `trafico_drogas`, `apreensao_armas`).
  - **Formato Vertical:** Linhas com `cod_ibge` / `codigo_ibge`, `municipio`, `natureza`/`delito`/`indicador`, `ano`, `mes`, `quantidade`/`total`/`ocorrencias`.
- **Delimitadores:** Ponto e vírgula (`;`) ou vírgula (`,`), codificação UTF-8 ou ISO-8859-1 (Latin1).

## 4. Periodicidade
- **Publicação:** Mensal com boletins semanais preliminares e consolidação mensal oficial.
- **Janela de Atualização:** Publicação até o 10º dia útil do mês subsequente ao fechamento da apuração pelo GEAC.
- **Histórico Disponível:** Séries consolidadas desde 2014 até o ano corrente.

## 5. Cobertura
- **Unidade Federativa:** Santa Catarina (SC).
- **Extensão Territorial:** Todos os 295 municípios catarinenses (100% de cobertura do território estadual).
- **Regiões de Segurança:** 1ª RPM (Grande Florianópolis), 2ª RPM (Lages/Serra), 3ª RPM (Balneário Camboriú), 4ª RPM (Chapecó/Oeste), 5ª RPM (Joinville/Norte), 6ª RPM (Criciúma/Sul), 7ª RPM (Blumenau/Vale do Itajaí), 8ª RPM (Tubarão), 9ª RPM (Fronteira), 10ª RPM (Joaçaba), 11ª RPM (São José) e 12ª RPM (Jaraguá do Sul).

## 6. Granularidade
- **Nível 1 (Municipal):** Identificado por Código IBGE de 7 dígitos (`cod_ibge` / `codigo_ibge`) e Nome do Município (`municipio`).
- **Nível 2 (Regional/AISP):** Regiões Integradas de Segurança Pública (RISP), Regiões de Polícia Militar (RPM) e Delegacias Regionais de Polícia (DRP).

## 7. Campos do Dataset Oficial

| Campo Original SSP-SC | Descrição | Tipo | Exemplo |
|---|---|---|---|
| `cod_ibge` / `codigo_ibge` | Código IBGE do Município (7 dígitos) | Integer / String | `4205407` (Florianópolis), `4209102` (Joinville), `4202404` (Blumenau) |
| `municipio` / `nome_municipio` | Nome do Município | String | `Florianópolis`, `Joinville`, `Blumenau`, `São José`, `Chapecó`, `Itajaí` |
| `ano` | Ano de Referência | Integer | `2024` |
| `mes` | Mês de Referência (1 a 12 ou nome por extenso) | Integer / String | `1` ou `Janeiro` |
| `natureza` / `delito` | Descrição da Natureza Penal (no formato vertical) | String | `Homicídio Doloso`, `Roubo de Veículo` |
| `homicidio_doloso` | Vítimas de Homicídio Doloso (MVI - Morte Violenta Intencional) | Integer | `8` |
| `latrocinio` | Vítimas de Latrocínio (Roubo Seguido de Morte) | Integer | `0` |
| `feminicidio` | Vítimas de Feminicídio | Integer | `1` |
| `lesao_morte` | Vítimas de Lesão Corporal Seguida de Morte | Integer | `0` |
| `roubo_veiculo` | Ocorrências de Roubo de Veículo | Integer | `24` |
| `furto_veiculo` | Ocorrências de Furto de Veículo | Integer | `68` |
| `roubo` / `roubo_geral` | Ocorrências de Roubo Geral / Transeunte / Estabelecimento | Integer | `185` |
| `furto` / `furto_geral` | Ocorrências de Furto Geral | Integer | `740` |
| `estupro` | Ocorrências de Estupro / Estupro de Vulnerável | Integer | `19` |
| `trafico_drogas` | Ocorrências de Tráfico de Drogas | Integer | `92` |
| `apreensao_armas` | Armas de Fogo Apreendidas | Integer | `35` |

## 8. Categorias e Mapeamento Canônico

O adapter `SspScAdapter` traduz as rubricas criminais catarinenses para a taxonomia canônica nacional:

| Rubrica / Coluna SSP-SC | Categoria Canônica | Agrupamento | Unidade |
|---|---|---|---|
| `Homicídio Doloso`, `Latrocínio`, `Feminicídio`, `Lesão Corporal Seguida de Morte`, `Morte Violenta Intencional` | `homicide` | violent | vitimas / ocorrencias |
| `Tentativa de Homicídio`, `Lesão Corporal Dolosa` | `bodily_harm` | violent | ocorrencias |
| `Estupro`, `Estupro de Vulnerável`, `Tentativa de Estupro` | `sexual_crime` | violent | vitimas / ocorrencias |
| `Roubo de Veículo` | `vehicle_robbery` | vehicle | ocorrencias |
| `Furto de Veículo` | `vehicle_theft` | vehicle | ocorrencias |
| `Roubo de Carga` | `cargo_theft` | property | ocorrencias |
| `Roubo`, `Roubo a Transeunte`, `Roubo a Comércio`, `Roubo a Residência`, `Extorsão` | `robbery` | property | ocorrencias |
| `Furto`, `Furto Qualificado`, `Furto Simples` | `theft` | property | ocorrencias |
| `Tráfico de Drogas`, `Posse de Drogas`, `Apreensão de Entorpecentes` | `drug_related` | drug | ocorrencias |
| `Apreensão de Armas`, `Estelionato`, `Outros Delitos` | `other` | other | armas / ocorrencias |

## 9. Metodologia
- Os dados estatísticos da SSP-SC são originados do Sistema Integrado de Segurança Pública (SISP), alimentado conjuntamente pela Polícia Civil (PCSC), Polícia Militar (PMSC) e Polícia Científica (PCI-SC).
- Passam por auditoria rigorosa e validação metodológica da Gerência de Estatística e Análise Criminal (GEAC).

## 10. Limitações
1. **Consolidação Periódica:** Relatórios preliminares podem sofrer ajustes finos na consolidação semestral pelo GEAC.
2. **Dados Agregados:** Séries públicas municipais agregam totais mensais sem dados de geolocalização exata de logradouros.
3. **Formatos Múltiplos:** Suporte nativo a planilhas matriciais (*wide*) e verticalizadas.

## 11. Estratégia de Download
- Ingestão via upload direto de arquivos no painel administrativo (`/api/admin/pipeline/trigger`).
- Download automatizado via `AutoDownloader` monitorando os relatórios estáticos da SSP-SC.
- Armazenamento RAW imutável em `storage/raw/ssp-sc/` com hash SHA-256 e contagem de bytes.

## 12. Estratégia de Parsing & Normalização
1. **Sanitização de Cabeçalhos:** Conversão para minúsculas, remoção de acentos e caracteres especiais.
2. **Quality Gate:** Validação estrita de colunas geográficas (`cod_ibge` ou `municipio`), período (`ano`, `mes`) e indicadores criminais.
3. **Resolução de Código IBGE:** Extração direta do código de 7 dígitos. Se ausente, resolução toponímica via `GeoNormalizationService`.
4. **Normalização Temporal:** Formatação canônica `YYYY-MM`.
5. **Deduplicação e Idempotência:** Chave determinística `ind_SSP-SC_SC_${muniCode}_${canonicalCategory}_${period}` prevenindo duplicidades.

## 13. Matriz de Risco
- **Risco de Duplicidade:** **BAIXO** (garantido por chave determinística no banco).
- **Risco de Quebra de Layout:** **BAIXO** (estrutura consolidada pelo SISP/GEAC).
- **Risco de Volumetria:** **BAIXO** (295 municípios x 12 meses x ~15 crimes = ~53.000 registros/ano).

## 14. Status
- **Status Operacional:** **OPERATIONAL**
- **Ambiente:** Integrado ao Pipeline Oficial de Ingestão e Suíte de Confiabilidade.
- **Data de Ativação:** 11/09/2026.
