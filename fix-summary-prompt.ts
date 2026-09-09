import fs from 'fs';

const filePath = 'src/services/SummaryService.ts';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /const prompt = `Você é um analista de dados especialista em segurança pública\.(.*?)DADOS ESTRUTURADOS:/s,
  `const prompt = \`Você é um analista de dados especialista em segurança pública.
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

DADOS ESTRUTURADOS:`
);

fs.writeFileSync(filePath, code);
