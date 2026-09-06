# Relatório de Auditoria da Arquitetura Atual

## 1. Banco de Dados (SQLite com Drizzle ORM)
O banco atual possui as seguintes tabelas principais (\`src/db/schema.ts\`):
- **locations**: Histórico de endereços pesquisados.
- **occurrences**: Armazena as ocorrências de segurança. Atualmente contém campos para \`source\`, \`category\`, coordenadas geográficas, dados de geocodificação (\`geocoding_status\`, \`geocoding_provider\`) e timestamp da ocorrência.
- **data_sources**: Metadados sobre os provedores de dados conectados (ex: SSP-SP).
- **import_batches**: Registra lotes de importação (status, quantidade, duplicatas).
- **geocoding_cache**: Armazena coordenadas pesquisadas para evitar requisições repetidas a provedores de mapa.
- **safety_analyses**: Guarda o score calculado e a confiança por local.

## 2. APIs do Servidor (Express em \`server.ts\`)
- \`/api/analysis\`: Calcula indicadores criminais dentro de um raio geográfico utilizando a fórmula de Haversine diretamente no SQL (SQLite). Baseia-se primariamente nas coordenadas das ocorrências (\`occurrences.latitude\`).
- \`/api/data-sources\`: Lista as fontes cadastradas.
- \`/api/admin/upload-ssp\` & \`/api/admin/download-sample\`: Endpoints para ingestão manual dos dados estaduais (SSP).
- \`/api/admin/data-quality\`: Retorna métricas analíticas de integridade e cobertura para o dashboard.

## 3. Mecanismos de Ingestão Atuais (\`src/ingestion/\`)
- Focado na SSP-SP (\`src/ingestion/ssp/\`).
- Contém um \`parser.ts\` para CSV e um \`normalizer.ts\` fortemente acoplado ao formato da SSP.
- \`DataIngestionService.ts\`: Responsável pela inserção e deduplicação no banco, registrando as métricas do lote de importação.
- **Limitações Atuais:** Não há rotinas automáticas (cron jobs), a arquitetura exige upload manual ou requisição na interface. O normalizador não implementa uma interface padronizada que permita conectar múltiplos provedores de diferentes formatos fluidamente.

## 4. Frontend e Interface (\`src/pages/\`)
- **Home.tsx**: Interface de busca por endereço via \`SearchBar\`.
- **Result.tsx**: Dashboard com Score, análise de Raio, Tipos de Crime.
- **Admin.tsx**: Painel dividido em "Ingestão de Dados" e "Qualidade dos Dados".
- **Preservação**: O frontend pode ser totalmente mantido. Componentes de pesquisa e gráficos não dependem da fonte dos dados, apenas das respostas consolidadas da API \`/api/analysis\`.

## 5. Próximos Passos e Avaliação de Compatibilidade
Para escalar para uma plataforma nacional (Sinesp, SSPs estaduais):
- **Ocorrências x Indicadores**: Atualmente a API espera dados granulares (pontos geográficos \`lat/lon\`). Os dados agregados do Sinesp não se encaixam aqui (precisamos de \`security_indicators\`).
- **Arquitetura Geográfica**: Precisamos adicionar tabelas/camadas para Estado (UF) e Município, possibilitando as buscas da \`/api/analysis\` consultarem indicadores agregados quando não houver granularidade num raio.
- **Engine de Ingestão**: Substituir a submissão manual do \`Admin\` por jobs independentes acionados via Engine Central.
