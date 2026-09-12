# Fonte Oficial de Dados: SINESP (Ministério da Justiça e Segurança Pública)

## 1. Fonte Real
- **Órgão Responsável:** Ministério da Justiça e Segurança Pública (MJSP) / Secretaria Nacional de Segurança Pública (SENASP)
- **Sistema Institucional:** Sistema Nacional de Informações de Segurança Pública (SINESP) / Sinesp VDE (Validador de Dados Estatísticos)
- **Identificador Canônico no Sistema:** `SINESP`
- **Dataset Canônico de Indicadores:** `indicadores_municipais`
- **Status de Validação de Rede:** **UNVALIDATED_REMOTE_BLOCKED** (Download automatizado bloqueado na origem)
- **Classificação Operacional:** **NÃO REAL / BLOQUEIO AUTOMATIZADO (Requer Ingestão Manual)**

---

## 2. Auditoria e Diagnóstico de Acesso Remoto

| Critério de Auditoria | Diagnóstico Técnico | Evidência / Status |
|---|---|---|
| **1. Fonte Real** | MJSP / SENASP - SINESP | Sistema federal integrador de estatísticas das 27 UFs |
| **2. URL Remota Legada** | `https://dados.mj.gov.br/...` | **INOPERANTE (DNS NXDOMAIN)**. O domínio `dados.mj.gov.br` foi descontinuado pelo Governo Federal na centralização de dados abertos. |
| **3. Nova URL do Portal** | `https://dados.gov.br/dados/conjuntos-dados/...` | **BLOQUEIO DE API (HTTP 401 Bearer)**. A nova plataforma do Governo Federal protege as rotas públicas de API com token Bearer. |
| **4. Portal Institucional** | `https://www.gov.br/mj/.../estatistica` | **BLOQUEIO WAF (HTTP 403 Forbidden)**. Protegido por WAF (F5 BIG-IP / Cloudflare) contra scrapers e requisições automatizadas em container. |
| **5. Exige Autenticação?** | **SIM para API REST**; **Sessão Interativa/CAPTCHA para Portal Web**. | Microdados detalhados pontuais são de acesso restrito exclusivo para operadores policiais autenticados. |
| **6. Formato Fornecido** | CSV e XLSX (tabelas de indicadores) | Não existe API REST pública aberta e anônima sem autenticação. |
| **7. Granularidade** | **Municipal e Mensal/Anual (Agregado)** | **geom=NULL**. Não contém endereço, rua, número, bairro nem coordenadas geográficas. |
| **8. Períodos Disponíveis** | Séries históricas de 2015 até o ano anterior/semestre anterior | Defasagem média de 30 a 90 dias; revisões semestrais e anuais da SENASP. |
| **9. Campos Existentes** | `UF`, `Município`, `Código IBGE` (recente), `Tipo Crime`, `Ano`, `Mês`, `Ocorrências`/`Vítimas` | Formato tabular semi-estruturado com variações de cabeçalho e separadores `;` e `,`. |
| **10. Identificação Municipal** | Nome textual do município + UF; Código IBGE em tabelas mais novas | Requer normalização ortográfica e resolução semântica para o código IBGE de 7 dígitos. |
| **11. Tipo de Dado** | **Estritamente AGREGADO** | Não são microdados pontuais. Cada registro é o total numérico consolidado do mês. |
| **12. Risco de Duplicação** | **ALTÍSSIMO com SSPs Estaduais** | O SINESP é alimentado pelas próprias SSPs estaduais. Somar SINESP + SSP-SP causa dupla contagem imediata. |
| **13. Uso Recomendado** | **Apenas Indicadores (`security_indicators`)** | **PROIBIDO USO PARA OCORRÊNCIAS (`security_occurrences`)**. |

---

## 3. Documentação do Bloqueio e O Que Precisa Ser Obtido

### Causa Raiz da Indisponibilidade de Download Automatizado
1. **Desativação do Portal Legado:** O link histórico de download automático (`dados.mj.gov.br/.../indicadoressegurancapublicamunicipios.csv`) falha com `getaddrinfo ENOTFOUND dados.mj.gov.br`. O governo federal encerrou a instância CKAN legada.
2. **Migração para Aplicação SPA e API Fechada:** A nova plataforma federal `dados.gov.br` foi reescrita como Single Page Application (SPA), e suas rotas de catálogo exigem autorização via cabeçalho `Authorization: Bearer <token>`.
3. **Mecanismo Anti-Automação no Portal Gov.br:** A navegação institucional em `gov.br/mj` implementa regras de WAF com desafio criptográfico e cookie `TScceab889027`, retornando `HTTP 403 Forbidden` a qualquer cliente HTTP automatizado (cURL, Axios, Python Requests).

### O Que Precisa Ser Obtido
Para utilizar dados oficiais do SINESP nesta plataforma:
1. **Download Manual:** O operador do sistema deve acessar o portal oficial `https://dados.gov.br` ou `https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica-da-seguranca-publica` através de um navegador autenticado.
2. **Extração:** Baixar a planilha consolidada oficial de Indicadores de Segurança Pública por Município (formato CSV ou XLSX).
3. **Ingestão via Pipeline:** Fazer o upload do arquivo obtido através do endpoint de upload administrativo `/api/ingestion/upload` ou depositar na pasta `raw_storage/indicadores_municipais/` para processamento pelo worker.

> **Regra Mandatória de Integridade:** O adapter `SinespAdapter` **NÃO** simula downloads de rede bem-sucedidos nem inventa registros sintéticos. Se o método `download()` for acionado, ele rejeita com erro explícito detalhando o bloqueio remoto.

---

## 4. Formatos e Schemas Suportados pelo Parser

O `SinespAdapter` é plenamente funcional para arquivos reais fornecidos via upload ou `raw_storage`, suportando variações de schema da administração pública federal:

### Formato 1: SINESP Municipal Padrão (Separador `;` ou `,`)
```csv
UF;Município;Tipo Crime;Ano;Mês;Ocorrências
SP;São Paulo;Homicídio doloso;2024;janeiro;45
RJ;Rio de Janeiro;Roubo de veículo;2024;janeiro;2000
MG;Belo Horizonte;Furto de veículo;2024;janeiro;400
BA;Salvador;Roubo de carga;2024;fevereiro;25
```

### Formato 2: SINESP com Código IBGE e Vítimas
```csv
Região;Sigla UF;Município;Código IBGE;Mês/Ano;Vítimas
Sudeste;SP;São Paulo;3550308;01/2024;45
Sudeste;RJ;Rio de Janeiro;3304557;01/2024;2000
Nordeste;BA;Salvador;2927408;02/2024;25
```

---

## 5. Mapeamento de Rubricas para Taxonomia Canônica Nacional

| Rubrica SINESP Original | Categoria Canônica | Unidade | Agrupamento |
|---|---|---|---|
| `Homicídio doloso` | `homicide` | occurrences / victims | violent |
| `Feminicídio` | `homicide` | occurrences / victims | violent |
| `Latrocínio` (Roubo seguido de morte) | `homicide` | occurrences / victims | violent |
| `Lesão corporal seguida de morte` | `homicide` | occurrences / victims | violent |
| `Tentativa de homicídio` | `assault` | occurrences | violent |
| `Lesão corporal dolosa` | `bodily_harm` | occurrences | violent |
| `Roubo de veículo` | `vehicle_robbery` | occurrences | vehicle |
| `Furto de veículo` | `vehicle_theft` | occurrences | vehicle |
| `Roubo de carga` | `cargo_theft` | occurrences | property |
| `Roubo a instituição financeira` | `robbery` | occurrences | property |
| `Roubo - outros` / `Roubo` | `robbery` | occurrences | property |
| `Furto` / `Furto - outros` | `theft` | occurrences | property |
| `Estupro` / `Estupro de vulnerável` | `sexual_crime` | occurrences / victims | violent |
| `Tráfico de drogas` / `entorpecentes` | `drug_related` | occurrences | drug |
| *Outras rubricas / não mapeadas* | `other` | occurrences | other |

---

## 6. Riscos de Sobreposição e Governança Multi-Fonte

### O Problema da Dupla Contagem
- As Secretarias de Segurança Pública dos Estados (ex: SSP-SP, ISP-RJ, SSP-BA) compilam suas estatísticas estaduais primárias e as submetem mensalmente ao Ministério da Justiça (SINESP).
- Se a plataforma somar ingenuamente indicadores com `SELECT SUM(value) FROM security_indicators WHERE state_code = 'SP'`, os números de crimes serão duplicados (contados uma vez pela SSP-SP e outra vez pelo SINESP).

### Arquitetura de Isolamento e Precedência
1. **Segregação na Camada de Dados:**
   - Todo registro do SINESP é gravado com `source_id = 'SINESP'`.
   - Todo registro da SSP-SP é gravado com `source_id = 'SSP-SP'`.
   - A chave única de banco `(source_id, state_code, municipality_code, category, period)` garante que uma fonte nunca sobregrava ou corrompe a outra.
2. **Precedência na Camada de Serviço (`SourcePriority.ts`):**
   - Para estados com integração estadual ativa (ex: SP com `SSP-SP`), a fonte primária é a estadual, pois possui maior granularidade, microdados pontuais e metodologia direta de boletins de ocorrência.
   - O SINESP atua como **baseline nacional** e cobertura agregada para estados que ainda não possuem adapter direto homologado.
3. **Controle na API Pública (`/api/public/v1/indicators`):**
   - O parâmetro `?source=SINESP` ou `?source=SSP-SP` permite ao consumidor filtrar explicitamente qual universo de dados deseja consultar, evitando agregações indevidas.

---

## 7. Status do Adapter e Conformidade

- **Adapter TypeScript:** `src/ingestion/adapters/sinesp/SinespAdapter.ts`
- **Validador de Schema:** `validateSchema(headers)` implementado e testado para formatos federais.
- **Normalizador de Linha:** `parseRow(row)` validado para meses, anos, IBGE, capitais e valores numéricos resilientes.
- **Status do Remote Fetching:** **BLOQUEADO (Não classificado como REAL / OPERACIONAL para sincronização automática via rede)**.
- **Status do Parsing e Pipeline:** **HOMOLOGADO PARA ARQUIVOS CSV OFICIAIS FORNECIDOS MANUALMENTE**.
