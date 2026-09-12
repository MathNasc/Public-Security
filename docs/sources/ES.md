# Ficha Técnica da Fonte: SESP-ES (Espírito Santo)

## 1. Identificação do Órgão e da Fonte
- **Órgão Responsável:** Secretaria de Estado da Segurança Pública e Defesa Social do Espírito Santo (SESP-ES)
- **Órgão Técnico/Estatístico:** Observatório da Segurança Pública do Espírito Santo (OSP-ES) em cooperação com o Instituto Jones dos Santos Neves (IJSN)
- **UF:** ES (Espírito Santo)
- **Status de Cobertura:** `OPERATIONAL`
- **Adapter Implementado:** `SespEsAdapter`
- **Portal Oficial:** [https://sesp.es.gov.br/](https://sesp.es.gov.br/)
- **Portal de Dados Abertos e Estatísticas:** [https://dados.es.gov.br/](https://dados.es.gov.br/) e [https://ijsn.es.gov.br/](https://ijsn.es.gov.br/)

## 2. Cobertura Geográfica e Territorial
- **Cobertura Territorial:** 100% dos 78 municípios do Estado do Espírito Santo.
- **Regiões Integradas de Segurança Pública (RISP / AISP):**
  - **Região Metropolitana da Grande Vitória:** Vitória (3205309), Vila Velha (3205200), Serra (3205002), Cariacica (3201308), Viana (3205101), Guarapari (3202405), Fundão (3202207).
  - **Região Sul:** Cachoeiro de Itapemirim (3201209), Marataízes (3203320), Itapemirim, Anchieta, Castelo, Mimoso do Sul, Alegre, Guaçuí, Presidente Kennedy, Iúna, Muniz Freire, etc.
  - **Região Norte:** Linhares (3203205), São Mateus (3204906), Aracruz (3200607), Nova Venécia (3203908), Conceição da Barra, Jaguaré, Pinheiros, Montanha, Pedro Canário, Boa Esperança, etc.
  - **Região Noroeste / Central:** Colatina (3201506), Barra de São Francisco (3200904), Baixo Guandu, Marilândia, São Gabriel da Palha, Pancas, Santa Maria de Jetibá, Santa Teresa, Domingos Martins, Afonso Cláudio, etc.

## 3. Tipologia de Dados e Indicadores Monitorados
A SESP-ES e o OSP-ES monitoram e consolidam os seguintes indicadores criminais estratégicos:

| Categoria Canônica | Indicadores SESP-ES | Unidade | Descrição / Detalhes |
|---|---|---|---|
| `homicide` | Homicídio Doloso, Mortes Violentas por Letalidade Intencional (MVLI), Latrocínio (Roubo Seguido de Morte), Feminicídio, Lesão Corporal Seguida de Morte | `vitimas` | Crimes violentos letais intencionais consolidados pelo Observatório da SESP-ES |
| `vehicle_robbery` | Roubo de Veículo / Roubo de Automóveis e Motocicletas | `ocorrencias` | Subtração violenta com emprego de ameaça ou arma de fogo |
| `vehicle_theft` | Furto de Veículo / Furto de Automóveis | `ocorrencias` | Subtração não violenta de veículos |
| `robbery` | Roubo a Pessoa / Transeunte, Roubo em Transporte Coletivo (Transcol/Urbano/Rodoviário), Roubo em Comércio, Roubo em Residência, CVP Geral | `ocorrencias` | Crimes violentos contra o patrimônio monitorados no Estado |
| `cargo_theft` | Roubo de Carga | `ocorrencias` | Subtração violenta de transportes de carga e caminhões |
| `theft` | Furto a Transeunte, Furto em Comércio, Furto em Residência, Furtos Diversos | `ocorrencias` | Subtrações sem violência à pessoa |
| `sexual_crime` | Estupro / Estupro de Vulnerável | `vitimas` | Crimes contra a dignidade sexual |
| `bodily_harm` | Tentativa de Homicídio, Lesão Corporal Dolosa, Violência Doméstica contra a Mulher | `ocorrencias` | Crimes contra a integridade corporal |
| `drug_related` | Tráfico de Entorpecentes / Posse e Uso de Drogas / Apreensão de Substâncias Ilícitas | `ocorrencias` | Ocorrências de comércio e apreensão de entorpecentes |
| `other` | Apreensão de Armas de Fogo / Mandados Judiciais Cumpridos | `armas` | Produtividade das polícias Civil e Militar do ES |

## 4. Periodicidade e Latência
- **Frequência de Atualização:** Mensal.
- **Latência Típica:** Divulgação mensal (entre o 5º e o 10º dia do mês subsequente).
- **Formatos Suportados no Ingestion Pipeline:**
  1. **Matricial / Wide:** Planilhas municipais com colunas específicas por rubrica criminal (`homicidio_doloso`, `latrocinio`, `roubo_veiculo`, `furto_veiculo`, `roubo_transeunte`, `roubo_comercio`, `roubo_residencia`, `roubo_coletivo`, etc.).
  2. **Verticalizado:** Tabelas relacionais `[cod_ibge / municipio, ano, mes, natureza / crime, total / quantidade]`.
