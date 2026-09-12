# Inventário de Funcionalidades (Features)

| Funcionalidade | Status | Detalhes | Ação Recomendada |
| --- | --- | --- | --- |
| **Mapa Interativo (Frontend)** | REAL | React-Leaflet exibindo mapa Mapbox/Esri, com marcadores e raio visual (Circle). | Manter. |
| **Pesquisa e Geocodificação** | REAL | Campo de busca que converte endereço para Lat/Lon e centraliza mapa. Usa cache interno. | Manter. |
| **Sumarização com Inteligência Artificial** | REAL | Usa modelo Gemini para criar um parágrafo textual sobre os crimes da área. | Manter. |
| **Taxonomia Universal (Motor)** | REAL | Converte categorias textuais (ex: "Homicídio Doloso") de diferentes planilhas para chaves únicas (`homicide`). | Manter e alimentar. |
| **Gráficos de Tendência** | REAL | Recharts lendo do backend para plotar série histórica no Frontend. | Manter. |
| **Extrator SSP-SP** | REAL | Capacidade do sistema em ingerir o CSV mensal da polícia de São Paulo. | Manter e testar com CSV daquele mês real. |
| **Extrator SINESP (Nacional)** | MOCK | Retornava dados falsos do CSV deletado. Atualmente inoperante para dados novos. | Desenvolver extrator real na Etapa X. |
| **Sistema de Jobs Assíncronos** | REAL | Queue em banco com `Worker` lendo a fila aos poucos, viabilizando uploads de milhões de linhas. | Consolidar (remover duplicidades). |
| **Automação de Downloads (AutoDownloader)** | PARCIAL | Testa pings (200 OK) nas URLs, mas ainda não extrai automaticamente arquivos novos `.zip`/`.csv`. | Evoluir na próxima Etapa. |
| **Gestão de Alertas e Favoritos** | PARCIAL/MOCK | Tabelas existem, botões existem (UI), mas não há autenticação de usuário para vincular "quem favoritou". | Desenvolver fluxo de Autenticação (JWT/Supabase). |
| **API Pública (Open Data)** | PARCIAL | Rotas montadas, com rate limiter. Tela de API Docs pronta. | Precisa validar AuthKey de terceiros (Fase futura). |
