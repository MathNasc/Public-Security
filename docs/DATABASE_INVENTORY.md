# Inventário do Banco de Dados

## ORM & Conexão
- **ORM:** Drizzle ORM
- **Driver:** Postgres.js (`queryClient` no `src/db/index.ts`)
- **Migrações:** `drizzle-kit`

## Tabelas Mapeadas (`schema.ts`)

### Geografia
| Tabela | Status | Responsabilidade | Risco |
| --- | --- | --- | --- |
| `geographic_states` | REAL | Armazena UF, Nome e Polígono (geom) dos Estados. | Baixo |
| `geographic_municipalities` | REAL | Armazena Cidades, IBGE code, Lat/Lon e geom (Polígono). | Baixo |

### Ocorrências & Indicadores
| Tabela | Status | Responsabilidade | Risco |
| --- | --- | --- | --- |
| `security_occurrences` | REAL | Ocorrências pontuais de B.O. (Lat/Lon exato). Usa índice `GIST`. | Alto volume, lentidão sem indexação. |
| `security_indicators` | REAL | Dados agregados (ex: Roubos Totais Mês X em SP). Usa chaves compostas. | Baixo |

### Metadados e Jobs
| Tabela | Status | Responsabilidade | Risco |
| --- | --- | --- | --- |
| `data_sources` | REAL | Catálogo de portais da transparência. | Baixo |
| `data_imports` | LEGADO | Tabela antiga de controle de Ingestão. | Deve ser substituída por `ingestion_jobs`. |
| `ingestion_jobs` | REAL | Tabela V2 de controle de fila assíncrona. | Baixo |
| `raw_storage` | REAL | Registra metadados dos CSVs baixados para evitar duplicidade. | Baixo |

### Features de Usuário
| Tabela | Status | Responsabilidade | Risco |
| --- | --- | --- | --- |
| `geocoding_cache` | REAL | Cache de ViaCEP/Nominatim para poupar cotas. | Baixo |
| `safety_analyses` | REAL | Cache de pontuações de segurança calculadas. | Baixo |
| `region_watchlists` / `region_alerts` | PARCIAL | Estrutura para Favoritos e Alertas. Não em uso prático sem Auth. | Baixo |
| `generated_summaries` | REAL | Cache de textos gerados via LLM. | Baixo |
