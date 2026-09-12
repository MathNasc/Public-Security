# Ficha Técnica da Fonte: SSPDS-CE (Ceará)

## 1. Identificação do Órgão e da Fonte
- **Órgão Responsável:** Secretaria da Segurança Pública e Defesa Social do Estado do Ceará (SSPDS-CE)
- **Órgão Técnico/Estatístico:** Superintendência de Pesquisa e Estratégia de Segurança Pública (SUPESP) / Gerência de Estatística e Geoprocessamento (GEESP)
- **UF:** CE (Ceará)
- **Status de Cobertura:** `OPERATIONAL`
- **Adapter Implementado:** `SspdsCeAdapter`
- **Portal Oficial:** [https://www.sspds.ce.gov.br/](https://www.sspds.ce.gov.br/)
- **Portal de Estatísticas:** [https://www.sspds.ce.gov.br/estatisticas-2/](https://www.sspds.ce.gov.br/estatisticas-2/) e [https://supesp.ce.gov.br/](https://supesp.ce.gov.br/)

## 2. Cobertura Geográfica e Territorial
- **Abrangência:** 184 Municípios do Estado do Ceará (100% dos municípios).
- **Regiões Integradas de Segurança:**
  - **Capital:** Fortaleza (AIS 1 a 10)
  - **Região Metropolitana de Fortaleza (RMF):** Caucaia, Maracanaú, Aquiraz, Maranguape, Eusébio, etc. (AIS 11 a 13)
  - **Interior Norte:** Sobral, Itapipoca, Canindé, Tianguá, etc. (AIS 14 a 18)
  - **Interior Sul:** Juazeiro do Norte, Crato, Iguatu, Quixadá, Russas, etc. (AIS 19 a 25)

## 3. Tipologia de Dados e Indicadores Monitorados
A SSPDS-CE adota metodologia padronizada de indicadores consolidados de segurança pública:

| Categoria Canônica | Indicadores SSPDS-CE / SUPESP | Unidade | Descrição / Detalhes |
|---|---|---|---|
| `homicide` | CVLI (Crimes Violentos Letais Intencionais), Homicídio Doloso, Latrocínio, Feminicídio, Lesão Corporal Seguida de Morte | `vitimas` | Total consolidado de mortes violentas intencionais |
| `vehicle_robbery` | Roubo de Veículos / CVP Veículo | `ocorrencias` | Subtração de automóveis e motocicletas com violência |
| `vehicle_theft` | Furto de Veículos / Furto de Autos e Motos | `ocorrencias` | Subtração de veículos sem violência |
| `robbery` | CVP Total (Crimes Violentos contra o Patrimônio), Roubo a Pessoa/Transeunte, Roubo em Coletivo, Roubo a Comércio, Roubo a Residência | `ocorrencias` | Total consolidado de roubos patrimoniais |
| `cargo_theft` | Roubo de Carga / CVP Carga | `ocorrencias` | Roubo de transporte rodoviário de cargas |
| `theft` | Furto Geral / Furtos Diversos | `ocorrencias` | Furtos simples e qualificados |
| `sexual_crime` | Crimes contra a Dignidade Sexual / Estupro / Estupro de Vulnerável | `vitimas` | Vítimas de estupro consumado e tentado |
| `bodily_harm` | Tentativa de Homicídio, Lesão Corporal Dolosa, Violência Doméstica | `ocorrencias` | Agressões e tentativas registradas |
| `drug_related` | Tráfico de Entorpecentes / Tráfico de Drogas / Apreensão de Drogas | `ocorrencias` | Flagrantes e registros de tráfico de substâncias ilícitas |
| `other` | Apreensão de Armas de Fogo | `armas` | Quantidade de revólveres, pistolas e fuzis apreendidos |

## 4. Periodicidade e Latência
- **Frequência de Atualização:** Mensal.
- **Latência Típica:** Divulgação entre o 5º e o 15º dia útil do mês subsequente ao fechamento.
- **Formatos Suportados no Ingestion Pipeline:**
  1. **Matricial / Wide:** Planilhas municipais com colunas específicas por indicador (CVLI, CVP, Furtos, etc.).
  2. **Verticalizado:** Tabelas com colunas `[municipio / cod_ibge, ano, mes, natureza / indicador, total / ocorrencias / vitimas]`.

## 5. Arquitetura de Ingestão e Processamento
1. **Raw Storage:** Armazenamento em `/data/raw/sspds-ce/{timestamp}/` com SHA-256 e metadata imutável.
2. **Quality Gate:** Validação prévia de schema via `validateSchema` antes da inserção.
3. **Geo-Normalização:** Resolução automática de códigos IBGE e nomes canônicos via `GeoNormalizationService`.
4. **Idempotência:** Limpeza transacional de duplicidades no reprocessamento preservando integridade das métricas.
