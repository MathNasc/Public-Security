/**
 * Formata e limpa o texto gerado pela Inteligência Artificial,
 * removendo artefatos técnicos, marcações desnecessárias e códigos brutos (como `null`).
 */
export function cleanAiText(rawText: string | null | undefined): string {
  if (!rawText) return '';

  return rawText
    // Remove cabeçalhos redundantes / em inglês gerados por respostas genéricas
    .replace(/^\s*\*\*Relatório Explicativo[^*]*\*\*\s*/gi, '')
    .replace(/^\s*#+\s*Relatório[^\n]*/gi, '')
    
    // Remove linhas divisórias Markdown brutas ("---")
    .replace(/^\s*---\s*$/gm, '')
    
    // Subtitui representações técnicas brutas de 'null' ou códigos por termos legíveis em português
    .replace(/\(\s*`?null`?\s*\)/gi, '')
    .replace(/`null`/gi, 'Não calculado')
    .replace(/\bnull\b/gi, 'não disponível')
    .replace(/Score de Segurança:\s*Não calculado\s*\([^)]*\)/gi, 'Score de Segurança: Não calculado')
    .replace(/\(\s*\)/g, '')
    
    // Remove linhas com pontuações soltas ou artefatos de tópicos sem conteúdo
    .replace(/^\s*\*\s*\*\*\s*:\s*\*\*/gm, '')
    
    // Normaliza quebras de linha múltiplas consecutivas (máximo 2)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

