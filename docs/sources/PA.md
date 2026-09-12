# Ficha Técnica da Fonte: SEGUP-PA (Pará)

## 1. Identificação do Órgão e da Fonte
- **Órgão Responsável:** Secretaria de Estado de Segurança Pública e Defesa Social do Pará (SEGUP-PA)
- **Órgão Técnico/Estatístico:** Diretoria de Estatística e Análise Criminal (SIEDS / DEAC - Sistema Integrado de Segurança Pública do Pará)
- **UF:** PA (Pará)
- **Status de Cobertura:** `OPERATIONAL`
- **Adapter Implementado:** `SegupPaAdapter`
- **Portal Oficial:** [https://www.segup.pa.gov.br/](https://www.segup.pa.gov.br/)
- **Portal de Estatísticas e Transparência:** [https://www.segup.pa.gov.br/estatisticas](https://www.segup.pa.gov.br/estatisticas) e [https://transparencia.pa.gov.br/](https://transparencia.pa.gov.br/)

## 2. Cobertura Geográfica e Territorial
- **Cobertura Territorial:** 100% dos 144 municípios do Estado do Pará.
- **Regiões Integradas de Segurança Pública (RISP / CPRP):**
  - **RISP 01 - Região Metropolitana de Belém (RMB):** Belém (1501402), Ananindeua (1500800), Marituba (1504422), Benevides (1501501), Santa Bárbara do Pará (1506351), Santa Izabel do Pará (1507003).
  - **RISP 02 - Guamá / Nordeste Paraense:** Castanhal (1502400), Bragança (1501709), Capanema (1502202), São Miguel do Guamá, Vigia, Salinópolis, Paragominas (1505502), Tomé-Açu, Tailândia (1507953).
  - **RISP 03 - Baixo Tocantins:** Abaetetuba (1500107), Barcarena (1501303), Cametá (1502103), Igarapé-Miri, Moju, Baião, Mocajuba.
  - **RISP 04 - Lago de Tucuruí:** Tucuruí (1508100), Breu Branco, Goianésia do Pará, Jacundá, Novo Repartimento.
  - **RISP 05 - Carajás / Sudeste Paraense:** Marabá (1504208), Parauapebas (1505536), Canaã dos Carajás, Curionópolis, Eldorado dos Carajás, São Geraldo do Araguaia.
  - **RISP 06 - Araguaia:** Redenção (1506138), Conceição do Araguaia, Xinguara, Santana do Araguaia, Ourilândia do Norte, Tucumã, São Félix do Xingu (1507300).
  - **RISP 07 - Xingu / Transamazônica:** Altamira (1500602), Brasil Novo, Medicilândia, Uruará, Placas, Vitória do Xingu, Anapu, Senador José Porfírio.
  - **RISP 08 - Tapajós:** Itaituba (1503606), Jacareacanga, Novo Progresso, Trairão, Rurópolis, Aveiro.
  - **RISP 09 - Baixo Amazonas:** Santarém (1506807), Alenquer, Monte Alegre, Óbidos, Oriximiná, Juruti, Mojuí dos Campos, Terra Santa.
  - **RISP 10 - Marajó Oriental e Ocidental:** Breves, Portel, Soure, Salvaterra, Afuá, Chaves, Curralinho, Anajás, Ponta de Pedras.

## 3. Tipologia de Dados e Indicadores Monitorados
A SEGUP-PA e a DEAC monitoram e consolidam os seguintes indicadores criminais estratégicos:

| Categoria Canônica | Indicadores SEGUP-PA | Unidade | Descrição / Detalhes |
|---|---|---|---|
| `homicide` | Homicídio Doloso, Crimes Violentos Letais Intencionais (CVLI), Latrocínio (Roubo Seguido de Morte), Feminicídio, Lesão Corporal Seguida de Morte | `vitimas` | Crimes violentos letais intencionais consolidados pela DEAC/SIEDS |
| `vehicle_robbery` | Roubo de Veículos (Automóveis, Motocicletas, Caminhões) | `ocorrencias` | Subtração violenta com emprego de arma de fogo ou ameaça |
| `vehicle_theft` | Furto de Veículos | `ocorrencias` | Subtração sem violência física ou ameaça |
| `robbery` | Roubo a Transeunte / Pessoa, Roubo a Comércio / Estabelecimento Comercial, Roubo a Residência, Roubo a Transporte Coletivo, Pirataria Fluvial / Roubo em Embarcações, CVP Geral | `ocorrencias` | Crimes violentos contra o patrimônio |
| `cargo_theft` | Roubo de Carga | `ocorrencias` | Subtração violenta de transportes de carga e caminhões nas rodovias paraenses |
| `theft` | Furto a Transeunte, Furto em Comércio, Furto em Residência, Furtos Gerais | `ocorrencias` | Subtrações de patrimônio sem ameaça ou violência |
| `sexual_crime` | Estupro / Estupro de Vulnerável | `vitimas` | Crimes contra a dignidade sexual registrados no SIEDS |
| `bodily_harm` | Tentativa de Homicídio, Lesão Corporal Dolosa, Violência Doméstica contra a Mulher | `ocorrencias` | Crimes contra a integridade física |
| `drug_related` | Tráfico de Entorpecentes / Posse e Uso de Drogas / Apreensões de Cocaína, Maconha e Oxi | `ocorrencias` | Ocorrências de combate ao narcotráfico |
| `other` | Apreensão de Armas de Fogo e Munições / Mandados Cumpridos | `armas` | Indicadores de produtividade policial e desarmamento |

## 4. Periodicidade e Latência
- **Frequência de Atualização:** Mensal.
- **Latência Típica:** Divulgação mensal (entre o 1º e o 10º dia do mês subsequente).
- **Formatos Suportados no Ingestion Pipeline:**
  1. **Matricial / Wide:** Planilhas municipais consolidadas com colunas para cada natureza (`homicidio_doloso`, `latrocinio`, `feminicidio`, `roubo_veiculo`, `furto_veiculo`, `roubo_transeunte`, `roubo_comercio`, `roubo_residencia`, `roubo_coletivo`, `estupro`, `trafico_drogas`, etc.).
  2. **Verticalizado:** Tabelas relacionais `[cod_ibge / municipio / risp, ano, mes, natureza / delito, total / quantidade]`.
