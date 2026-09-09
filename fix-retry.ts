import fs from 'fs';

const filePath = 'src/services/SummaryService.ts';
const code = `import { GoogleGenAI } from '@google/genai';

export class SummaryService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async generateSummary(structuredData: any): Promise<string> {
    const prompt = \`Você é um analista de dados especialista em segurança pública.
Escreva um resumo analítico claro, em português do Brasil, para o público geral.
O resumo não deve conter alucinações, e você deve basear-se ESTRITAMENTE nos dados estruturados abaixo.
Não assuma ou adivinhe causas. Mantenha o tom neutro e objetivo.

INSTRUÇÕES IMPORTANTES SOBRE DADOS VAZIOS:
Se os dados indicarem "insufficient_data" (status do score como "Dados insuficientes") ou se todas as estatísticas criminais forem iguais a 0 (zero), NÃO DESCREVA ISSO DE FORMA ROBÓTICA E TÉCNICA (ex: não diga "O score é 0 com confiança 0").
Em vez disso, aja de forma acolhedora e educada. Diga que "Ainda não temos dados históricos consolidados ou suficientes registrados no sistema para esta região específica."
Explique brevemente que o sistema está em constante atualização e novos dados oficiais serão importados em breve.
Se não houver dados, não crie tópicos listando variáveis técnicas como previousScore, indicators, ou zeros. Mantenha um texto fluido de no máximo 2 parágrafos tranquilizando o usuário.

Caso Haja Dados Reais (Score acima de zero):
Descreva a variação no Score de Segurança e os indicadores que subiram ou desceram.
Mencione também os 2 principais indicadores que subiram ou caíram (comparando "indicators" com "previousIndicators").

DADOS ESTRUTURADOS:
\${JSON.stringify(structuredData, null, 2)}\`;

    const modelsToTry = [
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    for (const model of modelsToTry) {
      let retries = 2; // Allow 2 retries per model
      
      while (retries >= 0) {
        try {
          const response = await this.ai.models.generateContent({
            model: model,
            contents: prompt,
          });
          return response.text || 'Não foi possível gerar um resumo no momento.';
        } catch (error: any) {
          const is503 = error?.message?.includes('503') || error?.status === 'UNAVAILABLE';
          const is429 = error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED';
          
          if ((is503 || is429) && retries > 0) {
            // Wait 1.5s and retry
            await new Promise(r => setTimeout(r, 1500));
            retries--;
            continue;
          }
          
          console.error(\`Failed to generate summary with model \${model}:\`, error.message || error);
          break; // Break the retry loop and go to next model
        }
      }
    }
        
    return 'Resumo temporariamente indisponível devido a alta demanda nos servidores de IA. Por favor, tente novamente em alguns instantes.';
  }
}
`;

fs.writeFileSync(filePath, code);
