# Ficha Técnica da Fonte: SSP-GO (Goiás)

## 1. Identificação do Órgão e da Fonte
- **Órgão Responsável:** Secretaria de Estado da Segurança Pública de Goiás (SSP-GO)
- **Órgão Técnico/Estatístico:** Observatório de Segurança Pública do Estado de Goiás (OSPEGO) / Gerência do Observatório de Segurança Pública (GOSP)
- **UF:** GO (Goiás)
- **Status de Cobertura:** `OPERATIONAL`
- **Adapter Implementado:** `SspGoAdapter`
- **Portal Oficial:** [https://www.seguranca.go.gov.br/](https://www.seguranca.go.gov.br/)
- **Portal de Dados Abertos e Estatísticas:** [https://dadosabertos.ssp.go.gov.br/](https://dadosabertos.ssp.go.gov.br/) e [https://www.seguranca.go.gov.br/estatisticas/](https://www.seguranca.go.gov.br/estatisticas/)

## 2. Cobertura Geográfica e Territorial
- **Abrangência:** 246 Municípios do Estado de Goiás (100% dos municípios).
- **Regiões Integradas de Segurança Pública (RISP / CRPM):**
  - **1ª RISP (Goiânia e Região Metropolitana):** Goiânia, Aparecida de Goiânia, Senador Canedo, Trindade, Goianira, etc.
  - **RISP Entorno do DF:** Águas Lindas de Goiás, Luziânia, Valparaíso de Goiás, Formosa, Novo Gama, Cidade Ocidental, Planaltina, Santo Antônio do Descoberto, Cristalina.
  - **RISP Centro-Sul / Sudeste:** Anápolis, Rio Verde, Jataí, Itumbiara, Catalão, Caldas Novas, Morrinhos.
  - **RISP Norte / Noroeste / Nordeste:** Porangatu, Uruaçu, Goianésia, Posse, Iporá, São Miguel do Araguaia, Ceres.

## 3. Tipologia de Dados e Indicadores Monitorados
A SSP-GO / OSPEGO monitora e consolida indicadores estratégicos de criminalidade e produtividade policial:

| Categoria Canônica | Indicadores SSP-GO / OSPEGO | Unidade | Descrição / Detalhes |
|---|---|---|---|
| `homicide` | Homicídio Doloso, Latrocínio (Roubo Seguido de Morte), Feminicídio, Lesão Corporal Seguida de Morte, CVLI | `vitimas` | Mortes violentas intencionais consolidadas |
| `vehicle_robbery` | Roubo de Veículos / Roubo de Automóveis e Motocicletas | `ocorrencias` | Subtração de veículos automotores mediante violência ou grave ameaça |
| `vehicle_theft` | Furto de Veículos / Furto de Automóveis e Motocicletas | `ocorrencias` | Subtração de veículos sem emprego de violência |
| `robbery` | Roubo a Transeunte / Pessoa, Roubo em Transporte Coletivo, Roubo em Comércio, Roubo em Residência, Roubo em Propriedade Rural, Roubo Geral | `ocorrencias` | Crimes violentos contra o patrimônio |
| `cargo_theft` | Roubo de Cargas | `ocorrencias` | Subtração violenta de transportes de mercadorias |
| `theft` | Furto Geral / Furtos a Transeunte, Comércio, Residência e Propriedade Rural | `ocorrencias` | Furtos simples e qualificados |
| `sexual_crime` | Estupro / Estupro de Vulnerável | `vitimas` | Vítimas de violência sexual |
| `bodily_harm` | Tentativa de Homicídio, Lesão Corporal Dolosa, Violência Doméstica | `ocorrencias` | Agressões físicas e tentativas de crimes contra a vida |
| `drug_related` | Tráfico de Drogas / Tráfico de Entorpecentes / Apreensão de Drogas | `ocorrencias` | Ocorrências e flagrantes de comércio de substâncias ilícitas |
| `other` | Apreensão de Armas de Fogo / Foragidos Recapturados | `armas` | Armas de fogo apreendidas (revólveres, pistolas, fuzis e espingardas) |

## 4. Periodicidade e Latência
- **Frequência de Atualização:** Mensal.
- **Latência Típica:** Divulgação entre o 5º e o 12º dia útil do mês subsequente.
- **Formatos Suportados no Ingestion Pipeline:**
  1. **Matricial / Wide:** Planilhas municipais com colunas para cada indicador penal (`homicidio_doloso`, `latrocinio`, `roubo_veiculo`, `furto_veiculo`, etc.).
  2. **Verticalizado:** Tabelas com colunas `[municipio / cod_ibge, ano, mes, natureza / crime, total / ocorrencias / vitimas]`.

## 5. Arquitetura de Ingestão e Processamento
1. **Raw Storage:** Armazenamento em `/data/raw/ssp-go/{timestamp}/` com SHA-256 e metadata imutável.
2. **Quality Gate:** Validação estrita de schema via `validateSchema` antes da inserção.
3. **Geo-Normalização:** Resolução automática de códigos IBGE e nomes canônicos via `GeoNormalizationService`.
4. **Idempotência:** Limpeza transacional de duplicidades no reprocessamento preservando integridade das métricas.
