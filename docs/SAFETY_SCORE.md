# Novo Safety Score

O algoritmo provisório da Fase 1-5 (`100 - weightedDensity / 5`) foi preterido em favor de um modelo pautado em contexto e não em abstração arbitrária.

## Como funciona (Granularidade = Coordenada)
O sistema lê o número de ocorrências exatas por categoria num raio (`R`), anualiza esse número e calcula a densidade de eventos ponderados por Severidade (`Crimes Violentos = 5x, Crimes contra Propriedade = 2x, Veículos = 2x`). 
A nova fórmula é `100 - (Densidade / 2)`.

## Como funciona (Granularidade = Municipal)
Onde não há coordenadas precisas, caímos para o indicador IBGE do município intersectado.
Calculamos a taxa de incidentes de Segurança ponderados por `100k` habitantes (Taxa de Criminalidade) anualizada.
A nova fórmula é `100 - (Taxa/100k / 20)`.

## Falta de Dados (Status)
Caso os cálculos resultem vazios, não fornecemos um `Score 100` (Falso Positivo de Segurança Absoluta). Devolvemos Status `insufficient_data` indicando transparência para o usuário de que faltam fontes para atestar algo naquela localidade.
