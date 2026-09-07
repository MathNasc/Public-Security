# Consolidacão (Consolidation)

A política de consolidação resolve o maior risco de Data Quality: **Dupla Contagem**.

## 1. O Problema
Um assalto ocorrido em São Paulo é reportado pela Secretaria (SSP-SP) em sua base estadual. No fim do mês, SP envia esse dado ao Ministério da Justiça (SINESP) que publica a mesma estatística no dataset nacional. Se somarmos ambos, temos 2 assaltos fictícios no banco.

## 2. Abordagem de Preferência Geográfica (Fallback)
A Fase 6 introduziu a `SourcePriority`. 
Ao consultar as ocorrências e indicadores de um município:
1. Verificamos se há integração direta estadual (`SSP-SP`, `ISP-RJ`, `SSP-MG`).
2. Se houver, a consulta **filtra exclusivamente (`WHERE source_id = 'SSP-SP'`)** essa fonte. O `SINESP` é totalmente ignorado para este estado, pois ele é redundante e com menor granularidade.
3. Para estados sem integração (Bahia, Acre, etc), o SINESP atua como Fonte Primária (*Fallback*), provendo uma cobertura de nível municipal.

## 3. Comparabilidade Híbrida
Graças a essa arquitetura, garantimos que todas as requisições API não façam *SUM()* desenfreados em bases de origens distintas para o mesmo período e local.

## 4. Agrupamento (Taxonomia)
As fontes estaduais possuem nomenclaturas peculiares (ex: `hom_doloso` x `Homicídio Consumado`). Na consolidação, agrupamos pelo metadado Canonical `homicide` ou pelo Category Group `violent`, sem sobrescrever os dados.
