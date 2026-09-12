# Especificação Técnica do Adapter: SEGUP-PA

## 1. Visão Geral da Integração
- **Módulo:** `src/ingestion/adapters/segup-pa/SegupPaAdapter.ts`
- **Fonte Primária:** Secretaria de Estado de Segurança Pública e Defesa Social do Pará (SEGUP-PA) / Sistema Integrado de Segurança Pública (SIEDS) / Diretoria de Estatística e Análise Criminal (DEAC).
- **Target Principal:** `securityIndicators` (com suporte a expansão para `securityOccurrences`).
- **Padrão de Período:** `YYYY-MM`.

## 2. Quality Gate & Validação de Schemas
O `SegupPaAdapter` suporta automaticamente os dois formatos emitidos pelos relatórios oficiais do Pará:
1. **Formato Matricial (Wide):**
   - Colunas obrigatórias: `cod_ibge` (ou `municipio`/`cidade`/`risp`), `ano`, `mes` (ou `periodo`).
   - Colunas de métricas criminais: `homicidio_doloso`, `latrocinio`, `feminicidio`, `lesao_morte`, `roubo_veiculo`, `furto_veiculo`, `roubo_transeunte` / `roubo_pessoa`, `roubo_comercio`, `roubo_residencia`, `roubo_coletivo`, `furto`, `estupro`, `trafico_drogas`, `apreensao_armas`.
2. **Formato Vertical:**
   - Colunas obrigatórias: `cod_ibge` / `municipio`, `ano`, `mes`, `natureza` / `crime` / `delito`, `total` / `quantidade` / `ocorrencias`.

## 3. Mapeamento Taxonômico Canônico
- **`homicide` (CVLI / Mortes Violentas Intencionais):**
  - Homicídio Doloso, Feminicídio, Latrocínio (Roubo Seguido de Morte), Lesão Corporal Seguida de Morte, CVLI.
- **`vehicle_robbery`:**
  - Roubo de Veículos, Roubo de Automóveis, Roubo de Motos/Ciclomotores.
- **`vehicle_theft`:**
  - Furto de Veículos, Furto de Automóveis, Furto de Motos.
- **`robbery` (CVP / Crimes Violentos contra o Patrimônio):**
  - Roubo a Transeunte / Roubo de Transeunte / Roubo a Pessoa.
  - Roubo em Estabelecimento Comercial / Roubo a Comércio.
  - Roubo em Residência / Roubo a Residência.
  - Roubo em Transporte Coletivo / Roubo a Ônibus.
  - Pirataria Fluvial / Roubo em Embarcação / Roubo Fluvial.
  - Roubo Diversos / Roubo Outros / CVP Total.
- **`cargo_theft`:**
  - Roubo de Carga.
- **`theft`:**
  - Furto a Transeunte, Furto em Comércio, Furto em Residência, Furto Geral / Furtos Diversos.
- **`sexual_crime`:**
  - Estupro, Estupro de Vulnerável.
- **`bodily_harm`:**
  - Tentativa de Homicídio, Lesão Corporal Dolosa, Violência Doméstica.
- **`drug_related`:**
  - Tráfico de Entorpecentes / Tráfico de Drogas, Posse e Uso de Drogas.
- **`other`:**
  - Apreensão de Armas de Fogo, Apreensão de Munições, Cumprimento de Mandados de Prisão.
