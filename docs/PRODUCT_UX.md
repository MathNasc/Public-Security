# Produto, UX e Explicabilidade (Fase 7)

## Visão Geral
Nesta fase final do MVP, consolidamos o arcabouço tecnológico de PostGIS, Data Ingestion e Metodologia da Fase 6 em uma interface orientada ao cidadão comum. 
O objetivo foi entregar confiança sem jargão técnico.

## Mudanças de UX Implementadas

1. **Busca Universal no Centro da Home (`SearchBar.tsx`)**
   - O usuário não digita coordenadas, mas endereços, CEPs ou cidades livremente via proxy Nominatim.
   - Respostas de Autocomplete com fallback legível para Estado/Cidade.

2. **Hierarquia da Página de Resultados (`Result.tsx`)**
   - **Cabeçalho:** Mostra claramente a intenção da busca atual e abriga um controle ágil (SearchBar miniaturizado) no topo para buscas subsequentes e disparador da funcionalidade de **Comparação**.
   - **Score & Confidence:** Desacoplados. O Score indica a pontuação final de segurança (0 a 100 sem casas decimais), enquanto a Confiança (%) atesta a viabilidade dos dados. Textos mutáveis explicam *por que* o cálculo é confiável.
   - **Dados Insuficientes (Status Limpo):** Eliminamos o perigoso "0 crimes = 100 Score". Se a API grita que o período não possui cobertura na granularidade exigida, substituímos o anel colorido por um painel cinza de `Dados insuficientes` que não induz o usuário ao erro.
   - **Comparação Regional (`Compare.tsx`):** Rota adicionada que espelha os scores e emite um alerta caso a comparação esteja sendo feita de forma desonesta (Ex: Comparando uma base municipal com uma de Raio Exato).

3. **Explicabilidade Sem Menu Escondido**
   - Não há modais densas. O rodapé da interface abre o capô com as variáveis exatas ingeridas.
   - **Qualidade, Fonte e Atualidade:** Listamos que a base provém, por exemplo, da "SSP-SP", o nível de cobertura municipal daquele dia da ingestão (Quality Score) e a data (Freshness). 

4. **Performance e Acessibilidade**
   - Removida a exibição arbitrária de múltiplos painéis para focar na estatística primária. 
   - Apenas os crimes canônicos agrupados (Violentos, Propriedade, Veículos) são iterados.
   - Imagens ARIA em inputs e alto-contraste nativo nas escalas das cores vermelho/âmbar/verde usando a robustez da paleta do Tailwind (slate/amber).

## Testes Realizados
- **Endereço Completo:** Validação da exibição correta e fallback ao geocode municipal (Granularidade = `municipality`).
- **Nenhum Dado Local:** Testes simulando áreas com gap de importação engatilharam com sucesso a flag de `insufficient_data`.
- **Comparação Desalinhada:** O bloqueio visual de Alerta previne conclusões absolutas entre metodologias diferentes na View de Compare.

A infraestrutura agora une de ponta a ponta: do scraping e PostGIS até uma experiência B2C consumível e explicável.
