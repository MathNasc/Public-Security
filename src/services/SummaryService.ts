import { AiExplanationService, ControlledAiContext } from './AiExplanationService.js';

export class SummaryService {
  private explanationService: AiExplanationService;

  constructor() {
    this.explanationService = new AiExplanationService();
  }

  async generateSummary(structuredData: any): Promise<string> {
    const rawData = structuredData?.data || structuredData;
    const resultData = rawData?.result || rawData;

    const context: ControlledAiContext = {
      mode: 'explanation',
      location: {
        city: resultData?.geographicIdentification?.municipality?.name || rawData?.city || rawData?.municipality || 'Localidade',
        state: resultData?.geographicIdentification?.state?.acronym || rawData?.state || 'BR',
        formattedAddress: resultData?.geographicIdentification?.municipality?.name
      },
      score: {
        value: resultData?.score !== undefined ? resultData.score : (rawData?.score !== undefined ? rawData.score : null),
        classification: rawData?.score?.classification || (resultData?.score !== null ? 'Analisado' : 'Dados insuficientes'),
        confidence: resultData?.confidence !== undefined ? resultData.confidence : (rawData?.confidence || 0)
      },
      period: {
        months: resultData?.period?.months || 12,
        label: resultData?.period?.label || rawData?.period?.label || 'últimos 12 meses'
      },
      indicators: resultData?.indicators || rawData?.indicators || [],
      sources: resultData?.sources || rawData?.sources || rawData?.dataSources || [],
      limitations: resultData?.limitations || rawData?.limitations || [],
      factors: resultData?.factors || rawData?.factors || [],
      fallback: resultData?.fallback || rawData?.fallback || { used: false },
      trend: resultData?.trend || rawData?.trend,
      status: resultData?.status || rawData?.status || (resultData?.indicators?.length > 0 ? 'available' : 'insufficient_data'),
      dataAbsenceNotice: resultData?.dataAbsenceNotice || rawData?.dataAbsenceNotice
    };

    const explanationResult = await this.explanationService.processExplanation(context);
    return explanationResult.response;
  }

  static generateDeterministicFallback(data: any): string {
    return AiExplanationService.generateDeterministicExplanation({
      location: { city: data?.city, state: data?.state },
      indicators: data?.indicators || [],
      sources: data?.sources || []
    });
  }
}
