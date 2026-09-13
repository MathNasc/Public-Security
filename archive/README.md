# ARCHIVE / QUARENTENA TÉCNICA (FASE 2)

**Data da Limpeza:** 13 de Setembro de 2026  
**Contexto:** Conclusão da Fase 2 — Limpeza Segura e Quarentena Técnica do Pipeline de Ingestão e Automação Multi-Estado.

---

## 1. Finalidade do Diretório
O diretório `/archive` serve como **quarentena técnica e repositório histórico** para scripts de descoberta, utilitários legados e fixtures de suporte que não fazem parte do pipeline ativo de produção nem das suítes oficiais de auditoria.

## 2. Status em Relação ao Pipeline de Produção
- **Isolamento de Produção:** Nenhum arquivo localizado em `/archive` é importado, executado ou referenciado pelo pipeline de produção (`src/ingestion/...`), pela API ou pelos testes oficiais em `/tests/`.
- **Proibição de Reintrodução:** Arquivos ou trechos de código arquivados **não devem ser reintroduzidos no pipeline ativo** sem passarem por nova validação de contrato canônico, sanitização e aprovação nas suítes formais de auditoria (`pipeline_automation_audit.ts` e `phase5_operational_hardening_audit.ts`).

## 3. Critérios de Arquivamento
Os arquivos presentes neste diretório foram classificados sob a **Categoria C (Quarentena / Arquivo)** da Fase 2 devido a:
1. **Descoberta Histórica:** Scripts desenvolvidos durante a fase de engenharia reversa e descoberta de APIs de Secretarias de Segurança Pública (SSP) estaduais.
2. **Utilitários de Suporte:** Scripts legados de carga manual ou população de registros que foram substituídos pela arquitetura oficial de provedores (`SspSpProvider`, `StateRegistry`, etc.).
3. **Fixtures e Amostras Brutas:** Planilhas e arquivos CSV estaduais legados sem vinculo direto com os testes automatizados da suíte oficial.

## 4. Estrutura Interna
- `archive/scripts/`: Scripts de descoberta de APIs estaduais, rotinas legadas de banco de dados e crawlers experimentais.
- `archive/fixtures/`: Planilhas XLSX e CSVs de amostra estaduais preservados para consulta histórica ou testes manuais específicos.
- `archive/legacy/`: Utilitários e geradores de relatórios descontinuados.
