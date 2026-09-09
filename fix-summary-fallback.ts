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
Não assuma ou adivinhe causas (ex: não diga que roubos aumentaram por causa do desemprego, ou porque o lugar é mais escuro).
Mantenha o tom neutro, objetivo, e descreva a variação no Score de Segurança e os indicadores que subiram ou desceram.
Se houver "previousScore" e "score", mencione a alteração do Score (ex: subiu X pontos ou caiu Y pontos).
Mencione também os 2 principais indicadores que subiram ou caíram (comparando "indicators" com "previousIndicators").

DADOS ESTRUTURADOS:
\${JSON.stringify(structuredData, null, 2)}\`;

    const modelsToTry = [
      'gemini-3.1-flash',
      'gemini-2.5-flash',
      'gemini-3.8-flash'
    ];

    for (const model of modelsToTry) {
      try {
        const response = await this.ai.models.generateContent({
          model: model,
          contents: prompt,
        });
        return response.text || 'Não foi possível gerar um resumo no momento.';
      } catch (error: any) {
        console.error(\`Failed to generate summary with model \${model}:\`, error.message || error);
        // If it's the last model, we break and return fallback string
        if (model === modelsToTry[modelsToTry.length - 1]) {
           return 'Resumo temporariamente indisponível devido a alta demanda nos servidores de IA.';
        }
      }
    }
    
    return 'Resumo temporariamente indisponível.';
  }
}
`;

fs.writeFileSync(filePath, code);
