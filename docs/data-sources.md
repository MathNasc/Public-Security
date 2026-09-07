# Inventário Nacional de Fontes de Dados (Vizinhança)

## Tabela de Fontes Priorizadas (Fase 5)

| Estado | Fonte (Órgão) | Dataset | Tipo | Granularidade | Automação (Grupo) | Prioridade |
|--------|--------------|---------|------|---------------|-------------------|------------|
| Nacional | MJSP | Ocorrências Criminais - Sinesp | Indicador | Município | Grupo A (CSV via Web) | Concluído (Fase 4) |
| SP | SSP-SP | Ocorrências Criminais (Mensal) | Ocorrência | Nível 1 (Lat/Lon) | Grupo A (CSV via Web) | Alta (Integrado) |
| RJ | ISP-RJ | Base de Dados de Municípios (Mensal) | Indicador | Município | Grupo A (CSV via Web) | Alta (Integrado) |
| MG | SEJUSP-MG | Estatísticas Criminais (Municípios) | Indicador | Município | Grupo A (CSV via Web) | Alta (Integrado) |
| BA | SSP-BA | Estatísticas Criminais | Misto | Município | Grupo C (Requer Web Scraping avançado) | Baixa |
| RS | SSP-RS | Indicadores Criminais | Indicador | Município | Grupo B (Excel via Web) | Média |
| PE | SDS-PE | Estatísticas de CVLI e CVP | Indicador | Município | Grupo B (PDF/Excel via Portal) | Baixa |

---

## 1. Ocorrências Criminais - SSP/SP
- **Estado:** SP
- **Órgão:** Secretaria da Segurança Pública do Estado de São Paulo
- **Dataset:** Ocorrências Criminais
- **URL Oficial:** http://www.ssp.sp.gov.br/transparenciassp/
- **Periodicidade:** Mensal
- **Tipo:** Ocorrências Individuais
- **Granularidade:** Endereço / Coordenadas Exatas (Nível 1)
- **Categorias (Normalizadas):** homicidio, roubo_veiculo, furto_veiculo, outros...
- **Metodologia:** BOs da Polícia Civil consolidados no fim do mês.
- **Limitações:** Atraso de 25-30 dias. Algumas coordenadas caem no meio da rua ou delegacia (precisão mista).
- **Adapter:** `SspSpAdapter`
- **Status:** Ativo

## 2. Base de Dados de Municípios (Mensal) - ISP/RJ
- **Estado:** RJ
- **Órgão:** Instituto de Segurança Pública do Rio de Janeiro
- **Dataset:** BaseMunicipioMensal
- **URL Oficial:** https://www.ispdados.rj.gov.br/Arquivos/BaseMunicipioMensal.csv
- **Periodicidade:** Mensal
- **Tipo:** Indicadores Agregados
- **Granularidade:** Município
- **Categorias (Normalizadas):** homicidio_doloso, latrocinio, roubo_veiculo, furto_veiculo (horizontalizado em colunas).
- **Metodologia:** Extração do SISPEN, consolidando estatísticas.
- **Limitações:** Sem coordenadas geográficas exatas. Necessário matching de IBGE (fmun).
- **Adapter:** `IspRjAdapter`
- **Status:** Ativo

## 3. Estatísticas Criminais (Municípios) - SSP/MG
- **Estado:** MG
- **Órgão:** Secretaria de Estado de Justiça e Segurança Pública (SEJUSP/MG)
- **Dataset:** Estatísticas Criminais
- **URL Oficial:** http://www.seguranca.mg.gov.br/dados
- **Periodicidade:** Mensal
- **Tipo:** Indicadores Agregados
- **Granularidade:** Município
- **Categorias (Normalizadas):** homicidio_doloso, roubo, furto, roubo_veiculo, furto_veiculo.
- **Metodologia:** Dados gerados pelo REDS (Registro de Eventos de Defesa Social).
- **Limitações:** Agregado sem coordenadas. Base em colunas.
- **Adapter:** `SspMgAdapter`
- **Status:** Ativo

## 4. Indicadores Criminais Municipais - SINESP
- **Estado:** Nacional
- **Órgão:** Ministério da Justiça e Segurança Pública
- **Dataset:** indicadores_municipais
- **URL Oficial:** https://dados.mj.gov.br/
- **Periodicidade:** Mensal (com revisões)
- **Tipo:** Indicadores Agregados
- **Granularidade:** Município
- **Metodologia:** Dados repassados pelas UFs ao sistema nacional.
- **Limitações:** Atraso embutido das UFs para a união. Pode diferir marginalmente das SSPs estaduais devido à datas de fechamento.
- **Adapter:** `SinespAdapter`
- **Status:** Ativo

---
**Nota de Risco (Dupla Contagem):** 
Nunca se deve agregar em uma mesma visualização estatística municipal SINESP e a fonte SSP correspondente ao mesmo estado (ex: somar homicídios do ISP-RJ com homicídios do SINESP para o RJ). Elas representam o mesmo universo de eventos.
