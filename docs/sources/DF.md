# Ficha Técnica da Fonte: SSP-DF (Distrito Federal)

## 1. Identificação do Órgão e da Fonte
- **Órgão Responsável:** Secretaria de Estado de Segurança Pública do Distrito Federal (SSP-DF)
- **Órgão Técnico/Estatístico:** Subsecretaria de Gestão da Informação (SGI) / Gerência de Estatística e Análise Criminal (GEAC)
- **UF:** DF (Distrito Federal)
- **Status de Cobertura:** `OPERATIONAL`
- **Adapter Implementado:** `SspDfAdapter`
- **Portal Oficial:** [https://www.ssp.df.gov.br/](https://www.ssp.df.gov.br/)
- **Portal de Dados Abertos e Estatísticas:** [https://dados.df.gov.br/](https://dados.df.gov.br/) e [https://www.ssp.df.gov.br/estatisticas/](https://www.ssp.df.gov.br/estatisticas/)

## 2. Cobertura Geográfica e Territorial
- **Particularidade Territorial e Jurídica:** O Distrito Federal não é subdividido em municípios, mas em **Regiões Administrativas (RAs)** (atualmente 35 RAs), todas vinculadas ao código IBGE `5300108` (Brasília/DF).
- **Regiões Administrativas (RAs):**
  - **RA I - Plano Piloto (Brasília)**
  - **RA II - Gama**
  - **RA III - Taguatinga**
  - **RA IV - Brazlândia**
  - **RA V - Sobradinho**
  - **RA VI - Planaltina**
  - **RA VII - Paranoá**
  - **RA VIII - Núcleo Bandeirante**
  - **RA IX - Ceilândia**
  - **RA X - Guará**
  - **RA XI - Cruzeiro**
  - **RA XII - Samambaia**
  - **RA XIII - Santa Maria**
  - **RA XIV - São Sebastião**
  - **RA XV - Recanto das Emas**
  - **RA XVI - Lago Sul**
  - **RA XVII - Riacho Fundo**
  - **RA XVIII - Lago Norte**
  - **RA XIX - Candangolândia**
  - **RA XX - Águas Claras**
  - **RA XXI - Riacho Fundo II**
  - **RA XXII - Sudoeste / Octogonal**
  - **RA XXIII - Varjão**
  - **RA XXIV - Park Way**
  - **RA XXV - SCIA / Estrutural**
  - **RA XXVI - Sobradinho II**
  - **RA XXVII - Jardim Botânico**
  - **RA XXVIII - Itapoã**
  - **RA XXIX - SIA**
  - **RA XXX - Vicente Pires**
  - **RA XXXI - Fercal**
  - **RA XXXII - Sol Nascente / Pôr do Sol**
  - **RA XXXIII - Arniqueira**
  - **RA XXXIV - Arapoanga**
  - **RA XXXV - Água Quente**

## 3. Tipologia de Dados e Indicadores Monitorados
A SSP-DF consolida indicadores criminais estratégicos:

| Categoria Canônica | Indicadores SSP-DF | Unidade | Descrição / Detalhes |
|---|---|---|---|
| `homicide` | Homicídio Doloso, Latrocínio (Roubo com Morte), Feminicídio, Lesão Corporal Seguida de Morte, CVLI | `vitimas` | Crimes violentos letais intencionais consolidados pela SSP-DF |
| `vehicle_robbery` | Roubo de Veículo / Roubo de Automóveis | `ocorrencias` | Subtração violenta de veículos automotores |
| `vehicle_theft` | Furto de Veículo / Furto de Automóveis | `ocorrencias` | Subtração não violenta de veículos |
| `robbery` | Roubo a Transeunte, Roubo em Transporte Coletivo, Roubo em Comércio, Roubo em Residência, CVP Geral | `ocorrencias` | Crimes violentos contra o patrimônio monitorados prioritariamente |
| `cargo_theft` | Roubo de Carga | `ocorrencias` | Roubo a transporte e logística de cargas |
| `theft` | Furto a Transeunte, Furto em Comércio, Furto em Residência, Furto Geral | `ocorrencias` | Furtos de patrimônio |
| `sexual_crime` | Estupro / Estupro de Vulnerável | `vitimas` | Crimes contra a dignidade sexual |
| `bodily_harm` | Tentativa de Homicídio, Lesão Corporal Dolosa, Violência Doméstica | `ocorrencias` | Ofensas à integridade física |
| `drug_related` | Tráfico de Drogas / Porte e Uso de Drogas / Apreensão de Entorpecentes | `ocorrencias` | Ocorrências de comércio e posse de entorpecentes |
| `other` | Apreensão de Armas de Fogo / Mandados de Prisão Cumpridos | `armas` | Produtividade das forças de segurança do DF |

## 4. Periodicidade e Latência
- **Frequência de Atualização:** Mensal.
- **Latência Típica:** Divulgação oficial no início de cada mês (até o 10º dia útil).
- **Formatos Suportados no Ingestion Pipeline:**
  1. **Matricial / Wide:** Planilhas por RA com colunas para cada indicador penal (`homicidio_doloso`, `latrocinio`, `roubo_veiculo`, `furto_veiculo`, `roubo_transeunte`, etc.).
  2. **Verticalizado:** Tabelas com colunas `[regiao_administrativa / ra / cod_ibge, ano, mes, natureza / crime, total / quantidade]`.
