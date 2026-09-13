import { db } from '../db/index.js';
import { geographicMunicipalities, securityOccurrences, securityIndicators, dataImports, dataSources } from '../db/schema.js';
import { eq, and, sql, desc, or, gte, lte } from "drizzle-orm";
import { TAXONOMY_VERSION, normalizeLegacyCategory, getCategoryGroup, normalizeLegacyCategoryFix, getCategoryGroupFix, CanonicalCategory, CategoryGroup } from './Taxonomy.js';
import { getPrimarySource } from '../ingestion/pipeline/SourcePriority.js';
import { GeoNormalizationService } from './GeoNormalizationService.js';
import { getBoundingBox, haversineDistance } from '../lib/geo.js';

export interface AnalysisRequest {
  lat: number;
  lon: number;
  radiusMeters: number;
  periodString?: string;
  periodMonths?: number;
}

export interface IndicatorValue {
  canonicalCategory: CanonicalCategory;
  categoryGroup: CategoryGroup;
  value: number;
  sourceCategory?: string;
}

export interface GeographicIdentification {
  municipalityName: string;
  stateAcronym: string;
  ibgeCode: string;
  population: number | null;
  latitude: number;
  longitude: number;
  resolutionMethod: 'postgis_containment' | 'centroid_proximity' | 'boundary';
}

export interface FallbackInfo {
  used: boolean;
  type: 'none' | 'municipal_aggregate' | 'state_aggregate' | 'national_aggregate';
  reason?: string;
  disclosure?: string;
}

export interface ExactOccurrence {
  id?: string;
  latitude: number;
  longitude: number;
  category: string;
  subcategory?: string | null;
  sourceCategory?: string | null;
  date: string;
  time?: string | null;
  address?: string | null;
  boNumber?: string | null;
  boYear?: number | null;
  delegacia?: string | null;
  bairro?: string | null;
  municipality?: string | null;
}

export interface AnalysisResult {
  score: number | null;
  status: 'insufficient_data' | 'low_confidence' | 'medium_confidence' | 'high_confidence';
  confidence: number;
  confidenceExplanation: string;
  geographicIdentification: GeographicIdentification;
  radius: {
    requestedMeters: number;
    applied: boolean;
    description: string;
  };
  period: {
    requested: string;
    start: string;
    end: string;
    effectiveMonths: number;
    label: string;
  };
  coverage: {
    temporal: number;
    geographic: number;
    spatial_precision: 'exact' | 'approximate' | 'aggregated' | 'unknown';
  };
  granularity: 'coordinate' | 'municipality' | 'state' | 'national';
  fallback: FallbackInfo;
  availableData: {
    totalRecords: number;
    categoriesFound: string[];
    microdataCount: number;
    indicatorsCount: number;
    status: 'available' | 'insufficient';
  };
  missingData: {
    notice: string;
    hasExactMicrodata: boolean;
    hasMunicipalIndicators: boolean;
  };
  factors: string[];
  limitations: string[];
  sources: Array<{
    id: string;
    name: string;
    provider?: string;
    updated_at: string;
    quality_score: number;
    isFallback?: boolean;
  }>;
  indicators: IndicatorValue[];
  trend: {
    previousPeriod: { start: string; end: string };
    previousScore: number | null;
    previousIndicators: IndicatorValue[];
  } | null;
  methodology: string;
  dataAbsenceNotice?: string;
  exactOccurrences?: ExactOccurrence[];
}

export class SafetyAnalysisService {
  private geoNorm = new GeoNormalizationService();

  async analyze(req: AnalysisRequest): Promise<AnalysisResult> {
    const lat = req.lat ?? (req as any).location?.latitude;
    const lon = req.lon ?? (req as any).location?.longitude;
    const { radiusMeters = 1000, periodMonths = 12, periodString = "12m" } = req;

    // Valida coordenadas geográficas
    const coordValidation = GeoNormalizationService.validateCoordinates(lat, lon);
    if (!coordValidation.valid || coordValidation.latitude === null || coordValidation.longitude === null) {
      return this.emptyResult(
        new Date(),
        new Date(),
        periodString,
        radiusMeters,
        null,
        'Coordenadas geográficas inválidas ou fora dos limites do Brasil.'
      );
    }

    const validLat = coordValidation.latitude;
    const validLon = coordValidation.longitude;

    // Determina o período temporal de análise
    const latestOcc = await this.getLatestAvailableDate();
    const referenceDate = latestOcc ? new Date(latestOcc) : new Date();

    let startDate = new Date(referenceDate);
    let endDate = new Date(referenceDate);
    let effectiveMonths = periodMonths;

    if (/^\d{4}$/.test(periodString)) {
      const year = parseInt(periodString, 10);
      startDate = new Date(`${year}-01-01T00:00:00Z`);
      endDate = new Date(`${year}-12-31T23:59:59Z`);
      effectiveMonths = 12;
    } else if (periodString === "1w") {
      startDate.setDate(startDate.getDate() - 7);
      effectiveMonths = 0.25;
    } else if (periodString === "1m") {
      startDate.setMonth(startDate.getMonth() - 1);
      effectiveMonths = 1;
    } else if (periodString === "3m") {
      startDate.setMonth(startDate.getMonth() - 3);
      effectiveMonths = 3;
    } else if (periodString === "6m") {
      startDate.setMonth(startDate.getMonth() - 6);
      effectiveMonths = 6;
    } else if (periodString === "all") {
      startDate.setFullYear(2010);
      effectiveMonths = 120;
    } else {
      startDate.setMonth(startDate.getMonth() - periodMonths);
    }

    // 1. Identificação do município para as coordenadas geográficas
    const muni = await this.resolveMunicipality(validLat, validLon);
    if (!muni) {
      return this.emptyResult(
        startDate,
        endDate,
        periodString,
        radiusMeters,
        null,
        'Nenhum município brasileiro identificado para as coordenadas informadas.'
      );
    }

    const geoId: GeographicIdentification = {
      municipalityName: muni.name,
      stateAcronym: muni.state_acronym || muni.state_code,
      ibgeCode: muni.ibge_code || muni.code,
      population: muni.population || null,
      latitude: validLat,
      longitude: validLon,
      resolutionMethod: muni.resolutionMethod || 'nearest_centroid'
    };

    // 2. Determinação da fonte oficial exclusiva (SSP-SP)
    if (geoId.stateAcronym !== 'SP') {
      return this.emptyResult(
        startDate,
        endDate,
        periodString,
        radiusMeters,
        geoId,
        `Esta versão do Public Security opera exclusivamente com dados oficiais da Secretaria de Segurança Pública de São Paulo (SSP-SP). Não há registros oficiais disponíveis para este local fora do estado de São Paulo.`
      );
    }

    const primarySourceId = 'SSP-SP';

    // 3. Busca de ocorrências exatas e indicadores municipais da SSP-SP
    let indicators: IndicatorValue[] = [];
    let exactOccurrences: any[] = [];
    let granularity: 'coordinate' | 'municipality' | 'state' | 'national' = 'municipality';
    let spatialPrecision: 'exact' | 'approximate' | 'aggregated' | 'unknown' = 'aggregated';
    let fallbackInfo: FallbackInfo = {
      used: false,
      type: 'none'
    };

    // Tenta primeiro buscar ocorrências exatas por proximidade geográfica (raio) na base oficial SSP-SP
    exactOccurrences = await this.fetchExactOccurrences(validLat, validLon, radiusMeters, startDate, endDate, primarySourceId);

    if (exactOccurrences.length > 0) {
      granularity = 'coordinate';
      spatialPrecision = 'exact';
      indicators = await this.aggregateOccurrences(validLat, validLon, radiusMeters, startDate, endDate, primarySourceId);
      fallbackInfo = {
        used: false,
        type: 'none'
      };

      // Se as ocorrências no raio indicam um município específico (ex: São Paulo), refina a identificação
      const muniVotes = new Map<string, number>();
      for (const occ of exactOccurrences) {
        if (occ.municipality) {
          const mNorm = occ.municipality.toUpperCase().trim();
          muniVotes.set(mNorm, (muniVotes.get(mNorm) || 0) + 1);
        }
      }
      if (muniVotes.size > 0) {
        const topMuni = Array.from(muniVotes.entries()).sort((a, b) => b[1] - a[1])[0][0];
        if (topMuni.includes('PAULO') || topMuni.includes('S.PAULO') || topMuni.includes('CAPITAL')) {
          geoId.municipalityName = 'São Paulo';
          geoId.ibgeCode = '3550308';
          geoId.population = 11451245;
        } else if (topMuni.includes('GUARULHOS')) {
          geoId.municipalityName = 'Guarulhos';
          geoId.ibgeCode = '3518800';
          geoId.population = 1392000;
        }
      }
    } else {
      // Se não houver ocorrências pontuais com coordenadas no raio, busca indicadores municipais oficiais da SSP-SP
      indicators = await this.aggregateIndicators(geoId, startDate, endDate, primarySourceId);
      
      if (indicators.length > 0) {
        granularity = 'municipality';
        spatialPrecision = 'aggregated';
        fallbackInfo = {
          used: true,
          type: 'municipal_aggregate',
          reason: `Microdados georreferenciados no raio de ${radiusMeters}m não foram disponibilizados pela fonte oficial (${primarySourceId}). Utilizando dados agregados oficiais no nível municipal.`,
          disclosure: `Atenção: Os dados exibidos refletem os totais oficiais do município de ${geoId.municipalityName} - ${geoId.stateAcronym} e não a precisão pontual do raio de ${radiusMeters}m.`
        };
      }
    }

    // 4. Metadados e Score de Qualidade da Fonte SSP-SP
    const effectiveSourceId = primarySourceId;
    const sourceMeta = await this.getSourceMetadata(effectiveSourceId);

    // REGRA OBRIGATÓRIA: Ausência de dados NUNCA pode virar score zero e nem ser interpretada como ausência de crimes
    if (indicators.length === 0 && exactOccurrences.length === 0) {
      return this.emptyResult(
        startDate,
        endDate,
        periodString,
        radiusMeters,
        geoId,
        `Sem registros criminais oficiais encontrados na base da SSP-SP para ${geoId.municipalityName} - ${geoId.stateAcronym} no período selecionado.`
      );
    }

    // 5. Cálculo de Cobertura e Score de Segurança
    const coverageScore = granularity === 'coordinate' ? 0.90 : 0.65;

    // Período anterior para cálculo de tendência
    const prevEndDate = new Date(startDate);
    const prevStartDate = new Date(startDate);
    prevStartDate.setTime(prevStartDate.getTime() - (endDate.getTime() - startDate.getTime()));

    let prevIndicators: IndicatorValue[] = [];
    if (granularity === 'coordinate') {
      prevIndicators = await this.aggregateOccurrences(validLat, validLon, radiusMeters, prevStartDate, prevEndDate, effectiveSourceId);
    } else {
      prevIndicators = await this.aggregateIndicators(geoId, prevStartDate, prevEndDate, effectiveSourceId);
    }

    const score = this.computeScore(indicators, granularity, radiusMeters, effectiveMonths, geoId.population || 100000);
    const previousScore = prevIndicators.length > 0 ? this.computeScore(prevIndicators, granularity, radiusMeters, effectiveMonths, geoId.population || 100000) : null;

    const trendData = {
      previousPeriod: { start: prevStartDate.toISOString(), end: prevEndDate.toISOString() },
      previousScore,
      previousIndicators: prevIndicators
    };

    // 6. Cálculo da Confiança (Confiança mede a qualidade do dado, NÃO a segurança do local)
    const freshnessMonths = sourceMeta?.lastImportDate ? 
      Math.max(0, (new Date().getTime() - sourceMeta.lastImportDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 12;
    const freshnessScore = Math.max(0, 1 - (freshnessMonths / 12));
    const qualityScore = sourceMeta?.qualityScore || 0.7;

    let confidence = (coverageScore * 0.4) + (qualityScore * 0.4) + (freshnessScore * 0.2);
    confidence = Math.min(1.0, Math.max(0, parseFloat(confidence.toFixed(2))));

    let status: AnalysisResult['status'] = 'high_confidence';
    if (confidence < 0.4) status = 'low_confidence';
    else if (confidence < 0.7) status = 'medium_confidence';

    // 7. Fatores que influenciaram o resultado
    const factors: string[] = [];
    const thefts = indicators.filter(i => i.canonicalCategory === 'theft').reduce((a, b) => a + b.value, 0);
    const robberies = indicators.filter(i => i.canonicalCategory === 'robbery').reduce((a, b) => a + b.value, 0);
    const vehicles = indicators.filter(i => i.categoryGroup === 'vehicle').reduce((a, b) => a + b.value, 0);
    const violent = indicators.filter(i => i.categoryGroup === 'violent').reduce((a, b) => a + b.value, 0);

    if (violent > 0) factors.push(`Incidência de crimes violentos contra a pessoa (${violent} registros) com peso 5x.`);
    if (robberies > 0) factors.push(`Ocorrência de roubos (${robberies} registros) com emprego de violência/ameaça.`);
    if (thefts > 0) factors.push(`Furtos patrimoniais (${thefts} registros) com peso de frequência.`);
    if (vehicles > 0) factors.push(`Furtos/roubos de veículos (${vehicles} registros).`);

    if (granularity === 'coordinate') {
      factors.push(`Densidade territorial calculada na área de abrangência do raio de ${radiusMeters} metros.`);
    } else {
      factors.push(`Taxa populacional proporcional calculada por 100 mil habitantes no município de ${geoId.municipalityName}.`);
    }
    factors.push(`Fator de anualização proporcional ao período selecionado (${effectiveMonths.toFixed(1)} meses).`);

    // 8. Limitações da Análise
    const limitations: string[] = [
      'Subnotificação crônica: apenas ocorrências formalmente registradas pelas polícias estaduais constam nas estatísticas.',
      'A ausência de registros oficiais NÃO pode ser interpretada como inexistência de crimes.',
      'A precisão espacial está estritamente limitada à granularidade fornecida pelo órgão público.'
    ];

    if (fallbackInfo.used) {
      limitations.push(
        `Fallback geográfico ativo: microdados georreferenciados pontuais não estavam disponíveis para este raio de ${radiusMeters}m; a análise utiliza a série histórica municipal agregada.`
      );
    }

    const totalRecords = indicators.reduce((acc, curr) => acc + curr.value, 0);
    const categoriesFound = Array.from(new Set(indicators.map(i => i.canonicalCategory)));

    const periodLabel = `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')} (${effectiveMonths.toFixed(0)} meses)`;

    return {
      score,
      status,
      confidence,
      confidenceExplanation: 'O nível de confiança avalia a completude, cobertura espacial e recência dos dados oficiais fornecidos, e NÃO o nível de segurança do local.',
      geographicIdentification: geoId,
      radius: {
        requestedMeters: radiusMeters,
        applied: granularity === 'coordinate',
        description: granularity === 'coordinate' 
          ? `Busca espacial aplicada ao raio de ${radiusMeters}m ao redor das coordenadas.`
          : `Ocorrências pontuais com coordenadas no raio de ${radiusMeters}m não foram disponibilizadas pela fonte; agregando no nível municipal.`
      },
      period: {
        requested: periodString,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        effectiveMonths,
        label: periodLabel
      },
      coverage: {
        temporal: 1.0,
        geographic: coverageScore,
        spatial_precision: spatialPrecision
      },
      granularity,
      fallback: fallbackInfo,
      availableData: {
        totalRecords,
        categoriesFound,
        microdataCount: exactOccurrences.length,
        indicatorsCount: indicators.length,
        status: 'available'
      },
      missingData: {
        notice: exactOccurrences.length === 0 
          ? 'Microdados georreferenciados ponto a ponto indisponíveis para este endereço; utilizando agregação municipal oficial.'
          : 'Registros restritos às categorias oficialmente publicadas pelo órgão público gestor.',
        hasExactMicrodata: exactOccurrences.length > 0,
        hasMunicipalIndicators: indicators.length > 0
      },
      factors,
      limitations,
      sources: [{
        id: effectiveSourceId,
        name: 'Secretaria de Segurança Pública de São Paulo (SSP-SP)',
        provider: 'Governo do Estado de São Paulo (SSP-SP)',
        updated_at: sourceMeta?.lastImportDate?.toISOString() || new Date().toISOString(),
        quality_score: qualityScore,
        isFallback: fallbackInfo.used
      }],
      indicators,
      exactOccurrences,
      trend: trendData,
      methodology: `${TAXONOMY_VERSION}; Metodologia de Ponderação Gravimétrica por Severidade Penal e Taxa Territorial/Demográfica baseada exclusivamente em dados oficiais da SSP-SP.`,
      dataAbsenceNotice: 'Ausência de registros oficiais reflete falta de cobertura ou dados não publicados pelo órgão responsável e NÃO deve ser interpretada como inexistência de crimes.'
    };
  }

  private async getLatestAvailableDate(): Promise<Date | null> {
    try {
      const latestOcc = await db
        .select({ occurredAt: securityOccurrences.occurredAt })
        .from(securityOccurrences)
        .where(sql`occurred_at IS NOT NULL`)
        .orderBy(desc(securityOccurrences.occurredAt))
        .limit(1);

      if (latestOcc && latestOcc.length > 0 && latestOcc[0].occurredAt) {
        return new Date(latestOcc[0].occurredAt);
      }
      return null;
    } catch {
      return null;
    }
  }

  private async resolveMunicipality(lat: number, lon: number): Promise<any> {
    // 1. Tenta PostGIS ST_Contains (caso PostGIS esteja disponível)
    try {
      const muniResult = await db.execute(sql`
        SELECT state_code, state_acronym, code as ibge_code, name, population 
        FROM ${geographicMunicipalities} 
        WHERE ST_Contains(geom::geometry, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))
        LIMIT 1
      `);
      if (muniResult && (muniResult as any[]).length > 0) {
        const row = (muniResult as any[])[0];
        return {
          ...row,
          resolutionMethod: 'postgis_containment'
        };
      }
    } catch {}

    // 2. Fallback espacial: busca pelo município mais próximo com base em coordenadas centróides
    const nearest = await this.geoNorm.findNearestMunicipality(lat, lon, 60000);
    if (nearest) {
      return {
        state_code: nearest.stateAcronym,
        state_acronym: nearest.stateAcronym,
        ibge_code: nearest.code,
        code: nearest.code,
        name: nearest.name,
        population: nearest.population,
        resolutionMethod: 'centroid_proximity'
      };
    }

    return null;
  }

  private computeScore(indicators: IndicatorValue[], granularity: string, radiusMeters: number, periodMonths: number, population: number): number | null {
    let violentCount = 0;
    let propertyCount = 0;
    let vehicleCount = 0;
    let totalCount = 0;

    for (const ind of indicators) {
      if (ind.categoryGroup === 'violent') violentCount += ind.value;
      if (ind.categoryGroup === 'property') propertyCount += ind.value;
      if (ind.categoryGroup === 'vehicle') vehicleCount += ind.value;
      totalCount += ind.value;
    }

    if (totalCount === 0) {
      return null;
    }

    let score = 0;
    if (granularity === 'coordinate') {
      const areaSqKm = Math.max(0.1, (Math.PI * Math.pow(radiusMeters / 1000, 2)));
      const annualMultiplier = 12 / Math.max(0.25, periodMonths);
      const severityWeightedIncidents = (violentCount * 5) + (propertyCount * 2) + (vehicleCount * 2);
      const weightedDensity = (severityWeightedIncidents * annualMultiplier) / areaSqKm;
      score = Math.max(0, Math.min(100, Math.round(100 - (weightedDensity / 2))));
    } else {
      const pop = population || 100000;
      const annualMultiplier = 12 / Math.max(0.25, periodMonths);
      const severityWeightedIncidents = (violentCount * 5) + (propertyCount * 2) + (vehicleCount * 2);
      const annualizedWeighted = severityWeightedIncidents * annualMultiplier;
      const ratePer100k = (annualizedWeighted / pop) * 100000;
      score = Math.max(0, Math.min(100, Math.round(100 - (ratePer100k / 20))));
    }
    return score;
  }

  private emptyResult(
    start: Date,
    end: Date,
    periodString: string = "12m",
    radiusMeters: number = 1000,
    geoId: GeographicIdentification | null = null,
    reason?: string
  ): AnalysisResult {
    const baseWarning = 'Ausência de dados oficiais para o local e período solicitados. A ausência de registros oficiais NÃO pode ser interpretada como ausência ou inexistência de crimes.';
    const notice = reason ? `${reason} ${baseWarning}` : baseWarning;

    return {
      score: null,
      status: 'insufficient_data',
      confidence: 0,
      confidenceExplanation: 'O nível de confiança avalia exclusivamente a completude e qualidade dos dados, e não o nível de segurança do local. Com zero dados registrados, a confiança é 0.',
      geographicIdentification: geoId || {
        municipalityName: 'Não identificado',
        stateAcronym: 'BR',
        ibgeCode: '0000000',
        population: null,
        latitude: 0,
        longitude: 0,
        resolutionMethod: 'boundary'
      },
      radius: {
        requestedMeters: radiusMeters,
        applied: false,
        description: `Consulta ao raio de ${radiusMeters}m não retornou dados oficiais.`
      },
      period: {
        requested: periodString,
        start: start.toISOString(),
        end: end.toISOString(),
        effectiveMonths: 12,
        label: `${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}`
      },
      coverage: { temporal: 0, geographic: 0, spatial_precision: 'unknown' },
      granularity: 'municipality',
      fallback: {
        used: false,
        type: 'none'
      },
      availableData: {
        totalRecords: 0,
        categoriesFound: [],
        microdataCount: 0,
        indicatorsCount: 0,
        status: 'insufficient'
      },
      missingData: {
        notice,
        hasExactMicrodata: false,
        hasMunicipalIndicators: false
      },
      factors: [
        'Dados oficiais insuficientes ou não publicados pelo órgão de segurança no período selecionado.'
      ],
      limitations: [
        'A ausência de dados pode indicar falta de transparência governamental ou de cobertura digital, e NÃO significa que o local é seguro.',
        'Apenas ocorrências formalmente registradas em boletins de ocorrência chegam às estatísticas oficiais.'
      ],
      sources: [],
      indicators: [],
      trend: null,
      methodology: `${TAXONOMY_VERSION}; Qualidade: Ausência de dados resulta obrigatoriamente em Score nulo (null), jamais zero.`,
      dataAbsenceNotice: notice
    };
  }

  private async getSourceMetadata(sourceId: string) {
    try {
      const canonicalSourceId = sourceId.toUpperCase();
      const res = await db.select().from(dataSources)
        .where(sql`UPPER(${dataSources.id}) = ${canonicalSourceId} OR UPPER(${dataSources.name}) = ${canonicalSourceId}`)
        .limit(1);

      const source = res && res.length > 0 ? res[0] : null;

      const imports = await db.select()
        .from(dataImports)
        .where(and(
          sql`UPPER(${dataImports.sourceId}) = ${canonicalSourceId}`,
          sql`UPPER(${dataImports.status}) = 'COMPLETED'`
        ))
        .orderBy(desc(dataImports.createdAt))
        .limit(1);

      let qualityScore = 0.85;
      let lastImportDate = source?.updatedAt || new Date();

      if (imports && imports.length > 0) {
        const imp = imports[0];
        const valid = imp.recordsValid || 0;
        const invalid = imp.recordsInvalid || 0;
        const total = valid + invalid;
        if (total > 0) {
          qualityScore = Math.max(0.1, Math.min(1.0, valid / total));
        }
        lastImportDate = imp.createdAt;
      }

      return {
        name: source?.name || sourceId,
        qualityScore,
        lastImportDate
      };
    } catch {
      return {
        name: sourceId,
        qualityScore: 0.75,
        lastImportDate: new Date()
      };
    }
  }

  private async fetchExactOccurrences(lat: number, lon: number, radiusMeters: number, startDate: Date, endDate: Date, sourceId: string): Promise<ExactOccurrence[]> {
    const canonicalSource = sourceId.toUpperCase();
    
    // Helper to format an occurrence row
    const formatOccurrence = (row: any): ExactOccurrence => {
      let extra: any = {};
      if (row.source_data) {
        try {
          extra = typeof row.source_data === 'string' ? JSON.parse(row.source_data) : row.source_data;
        } catch {}
      }

      const numBo = extra.NUM_BO || extra.N_DO_BO || extra.NUMERO_BO || row.source_record_id || null;
      const anoBo = extra.ANO_BO || row.year || (row.occurred_at ? new Date(row.occurred_at).getUTCFullYear() : null);
      const rawTime = extra.HORA_OCORRENCIA_BO || extra.HORA_FATO || null;
      let time: string | null = null;
      if (rawTime !== null && rawTime !== undefined) {
        const numTime = Number(rawTime);
        if (!isNaN(numTime) && numTime >= 0 && numTime < 1) {
          const totalMinutes = Math.round(numTime * 24 * 60);
          const hours = Math.floor(totalMinutes / 60) % 24;
          const minutes = totalMinutes % 60;
          time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        } else {
          time = String(rawTime).trim().substring(0, 5);
        }
      }
      const delegacia = extra.NOME_DELEGACIA_CIRCUNSCRICAO || extra.NOME_DELEGACIA || null;
      const bairro = extra.BAIRRO || null;
      const logradouro = extra.LOGRADOURO ? `${extra.LOGRADOURO}${extra.NUMERO_LOGRADOURO ? ', ' + extra.NUMERO_LOGRADOURO : ''}` : null;
      const address = row.original_address || logradouro || (bairro ? `${bairro}, ${row.municipality_name || 'SP'}` : null);

      return {
        id: row.id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        category: normalizeLegacyCategoryFix(row.category),
        subcategory: row.subcategory || extra.RUBRICA || null,
        sourceCategory: row.source_category || extra.NATUREZA_APURADA || extra.DELITO || null,
        date: row.occurred_at ? new Date(row.occurred_at).toISOString() : startDate.toISOString(),
        time,
        address,
        boNumber: numBo ? String(numBo) : null,
        boYear: anoBo ? parseInt(String(anoBo), 10) : null,
        delegacia,
        bairro,
        municipality: row.municipality_name || 'São Paulo'
      };
    };

    // 1. Tenta PostGIS se disponível
    try {
      const results = await db.execute(sql`
        SELECT id, category, subcategory, source_category, source_record_id, municipality_name, original_address, source_data,
               ST_Y(geom::geometry) as latitude, ST_X(geom::geometry) as longitude, occurred_at, year, month
        FROM ${securityOccurrences}
        WHERE UPPER(source_id) = ${canonicalSource}
          AND occurred_at >= ${startDate.toISOString()}
          AND occurred_at <= ${endDate.toISOString()}
          AND ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography) <= ${radiusMeters}
        ORDER BY occurred_at DESC
        LIMIT 250
      `);
      if (results && (results as any[]).length > 0) {
        return (results as any[]).map(formatOccurrence);
      }
    } catch {}

    // 2. Fallback espacial nativo (SQLite / Bounding Box + Haversine)
    try {
      const bbox = getBoundingBox(lat, lon, radiusMeters);
      const candidates = await db.execute(sql`
        SELECT id, category, subcategory, source_category, source_record_id, municipality_name, original_address, source_data,
               latitude, longitude, occurred_at, year, month
        FROM ${securityOccurrences}
        WHERE UPPER(source_id) = ${canonicalSource}
          AND latitude BETWEEN ${bbox.minLat} AND ${bbox.maxLat}
          AND longitude BETWEEN ${bbox.minLon} AND ${bbox.maxLon}
          AND occurred_at >= ${startDate.toISOString()}
          AND occurred_at <= ${endDate.toISOString()}
        ORDER BY occurred_at DESC
        LIMIT 500
      `);

      const filtered: ExactOccurrence[] = [];
      for (const row of candidates as any[]) {
        if (row.latitude !== null && row.longitude !== null) {
          const dist = haversineDistance(lat, lon, Number(row.latitude), Number(row.longitude));
          if (dist <= radiusMeters) {
            filtered.push(formatOccurrence(row));
          }
        }
      }
      return filtered.slice(0, 250);
    } catch {
      return [];
    }
  }

  private async aggregateOccurrences(lat: number, lon: number, radiusMeters: number, startDate: Date, endDate: Date, sourceId: string): Promise<IndicatorValue[]> {
    const occs = await this.fetchExactOccurrences(lat, lon, radiusMeters, startDate, endDate, sourceId);
    const map = new Map<string, number>();

    for (const occ of occs) {
      const cat = occ.category;
      map.set(cat, (map.get(cat) || 0) + 1);
    }

    return Array.from(map.entries()).map(([cat, val]) => {
      const canonical = normalizeLegacyCategoryFix(cat);
      return {
        canonicalCategory: canonical,
        categoryGroup: getCategoryGroupFix(canonical) || "other",
        value: val
      };
    });
  }

  private async aggregateIndicators(geoId: GeographicIdentification, startDate: Date, endDate: Date, sourceId: string): Promise<IndicatorValue[]> {
    const canonicalSource = sourceId.toUpperCase();
    const startPeriod = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const endPeriod = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Also prepare actual dates for securityOccurrences filtering
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    try {
      // 1. Try fetching from legacy securityIndicators (which used ibgeCode)
      const resultsIndicators = await db.execute(sql`
        SELECT category, MAX(source_category) as source_category, SUM(value) as value
        FROM ${securityIndicators}
        WHERE UPPER(source_id) = ${canonicalSource}
          AND (municipality_code = ${geoId.ibgeCode} OR municipality_code LIKE ${geoId.ibgeCode.substring(0, 6) + '%'})
          AND period >= ${startPeriod}
          AND period <= ${endPeriod}
        GROUP BY category
      `);

      // 2. Try fetching from the new securityOccurrences (where SINESP/ISP-RJ are stored without coordinates)
      let resultsOccurrences: any[] = [];
      if (canonicalSource === 'SINESP') {
        resultsOccurrences = await db.select({
          category: securityOccurrences.category,
          source_category: sql<string>`MAX(${securityOccurrences.sourceCategory})`,
          value: sql<number>`COUNT(*)`
        })
        .from(securityOccurrences)
        .where(
          and(
            eq(sql`UPPER(${securityOccurrences.sourceId})`, canonicalSource),
            or(eq(securityOccurrences.stateCode, geoId.stateAcronym), eq(securityOccurrences.stateCode, 'BR')),
            gte(securityOccurrences.occurredAt, startDate),
            lte(securityOccurrences.occurredAt, endDate)
          )
        )
        .groupBy(securityOccurrences.category);
      } else {
        resultsOccurrences = await db.select({
          category: securityOccurrences.category,
          source_category: sql<string>`MAX(${securityOccurrences.sourceCategory})`,
          value: sql<number>`COUNT(*)`
        })
        .from(securityOccurrences)
        .where(
          and(
            eq(sql`UPPER(${securityOccurrences.sourceId})`, canonicalSource),
            eq(securityOccurrences.stateCode, geoId.stateAcronym),
            or(
              sql`${securityOccurrences.municipalityName} IS NULL`,
              eq(sql`UPPER(${securityOccurrences.municipalityName})`, geoId.municipalityName.toUpperCase()),
              eq(securityOccurrences.municipalityName, geoId.ibgeCode)
            ),
            gte(securityOccurrences.occurredAt, startDate),
            lte(securityOccurrences.occurredAt, endDate)
          )
        )
        .groupBy(securityOccurrences.category);
      }

      const map = new Map<string, any>();

      // Merge legacy indicators
      for (const row of resultsIndicators as any[]) {
        const canonical = normalizeLegacyCategoryFix(row.category);
        if (!map.has(canonical)) {
          map.set(canonical, { val: 0, srcCat: row.source_category });
        }
        map.get(canonical).val += Number(row.value);
      }

      // Merge occurrences
      for (const row of resultsOccurrences as any[]) {
        const canonical = normalizeLegacyCategoryFix(row.category);
        if (!map.has(canonical)) {
          map.set(canonical, { val: 0, srcCat: row.source_category });
        }
        map.get(canonical).val += Number(row.value);
      }

      return Array.from(map.entries()).map(([cat, data]) => {
        return {
          canonicalCategory: cat as CanonicalCategory,
          categoryGroup: getCategoryGroupFix(cat as CanonicalCategory) || "other",
          value: data.val,
          sourceCategory: data.srcCat
        };
      });
    } catch (e) {
      console.error('Error in aggregateIndicators:', e);
      return [];
    }
  }
}
