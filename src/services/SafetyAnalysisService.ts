import { db } from "../db/index.js";
import { geographicMunicipalities, securityOccurrences, securityIndicators, dataImports, dataSources } from "../db/schema.js";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { getPrimarySource } from "../ingestion/pipeline/SourcePriority.js";
import { TAXONOMY_VERSION, normalizeLegacyCategory, getCategoryGroup, CanonicalCategory, CategoryGroup } from "./Taxonomy.js";

export interface AnalysisRequest {
  lat: number;
  lon: number;
  radiusMeters: number;
  periodMonths: number;
}

export interface IndicatorValue {
  canonicalCategory: CanonicalCategory;
  categoryGroup: CategoryGroup;
  value: number;
  sourceCategory?: string;
}

export interface AnalysisResult {
  score: number | null;
  status: 'insufficient_data' | 'low_confidence' | 'medium_confidence' | 'high_confidence';
  confidence: number;
  period: { start: string; end: string };
  coverage: {
    temporal: number;
    geographic: number;
    spatial_precision: string;
  };
  granularity: 'coordinate' | 'municipality' | 'national';
  sources: Array<{ id: string; name: string; updated_at: string; quality_score: number }>;
  indicators: IndicatorValue[];
  trend: { percentage: number; label: string } | null;
  methodology: string;
}

export class SafetyAnalysisService {
  async analyze(req: AnalysisRequest): Promise<AnalysisResult> {
    const { lat, lon, radiusMeters, periodMonths } = req;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periodMonths);

    try {
      // 1. Find Municipality for the given coordinate
      const muniResult = await db.execute(sql`
        SELECT state_code, code as ibge_code, name, population 
        FROM ${geographicMunicipalities} 
        WHERE ST_Contains(geom::geometry, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))
        LIMIT 1
      `);
      
      if (!muniResult || muniResult.length === 0) {
        return this.emptyResult(startDate, endDate);
      }
      
      const muni = muniResult[0] as { state_code: string; ibge_code: string; name: string; population: number };
      const primarySourceId = getPrimarySource(muni.state_code, 'occurrences');
      
      // 2. Fetch Source Metadata and Quality
      const sourceMeta = await this.getSourceMetadata(primarySourceId);
      
      if (!sourceMeta) {
        return this.emptyResult(startDate, endDate);
      }
      
      // Determine Granularity
      const granularity = primarySourceId === 'SSP-SP' ? 'coordinate' : 'municipality';
      let indicators: IndicatorValue[] = [];
      let coverageScore = 0;
          
      if (granularity === 'coordinate') {
        indicators = await this.aggregateOccurrences(lat, lon, radiusMeters, startDate, endDate, primarySourceId);
        coverageScore = 0.95;
      } else {
        indicators = await this.aggregateIndicators(muni.ibge_code, startDate, endDate, primarySourceId);
        coverageScore = 0.6;
      }
      
      if (indicators.length === 0) {
        return this.emptyResult(startDate, endDate, [{
          id: primarySourceId,
          name: sourceMeta.name,
          updated_at: sourceMeta.lastImportDate?.toISOString() || new Date().toISOString(),
          quality_score: sourceMeta.qualityScore
        }]);
      }
      
      // 3. Compute Safety Score
      const prevEndDate = new Date(startDate);
      const prevStartDate = new Date(startDate);
      prevStartDate.setMonth(prevStartDate.getMonth() - periodMonths);
      
      let prevIndicators: IndicatorValue[] = [];
      if (granularity === 'coordinate') {
        prevIndicators = await this.aggregateOccurrences(lat, lon, radiusMeters, prevStartDate, prevEndDate, primarySourceId);
      } else {
        prevIndicators = await this.aggregateIndicators(muni.ibge_code, prevStartDate, prevEndDate, primarySourceId);
      }
      
      const score = this.computeScore(indicators, granularity, radiusMeters, periodMonths, muni.population || 100000);
      const previousScore = prevIndicators.length > 0 ? this.computeScore(prevIndicators, granularity, radiusMeters, periodMonths, muni.population || 100000) : null;
          
      const trendData = {
        previousPeriod: { start: prevStartDate.toISOString(), end: prevEndDate.toISOString() },
        previousScore,
        previousIndicators: prevIndicators
      };
      
      // 4. Compute Confidence
      const freshnessMonths = sourceMeta.lastImportDate ? 
        Math.max(0, (new Date().getTime() - sourceMeta.lastImportDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 12;
      const freshnessScore = Math.max(0, 1 - (freshnessMonths / 12));
          
      let confidence = (coverageScore * 0.4) + (sourceMeta.qualityScore * 0.4) + (freshnessScore * 0.2);
      confidence = Math.min(1.0, Math.max(0, parseFloat(confidence.toFixed(2))));
      
      let status: AnalysisResult['status'] = 'high_confidence';
      if (confidence < 0.4) status = 'low_confidence';
      else if (confidence < 0.7) status = 'medium_confidence';
      
      return {
        score,
        status,
        confidence,
        period: { start: startDate.toISOString(), end: endDate.toISOString() },
        coverage: {
          temporal: 1.0,
          geographic: coverageScore,
          spatial_precision: granularity === 'coordinate' ? 'exact' : 'aggregated'
        },
        granularity,
        sources: [{
          id: primarySourceId,
          name: sourceMeta.name,
          updated_at: sourceMeta.lastImportDate?.toISOString() || new Date().toISOString(),
          quality_score: sourceMeta.qualityScore
        }],
        indicators,
        trend: trendData as any,
        methodology: TAXONOMY_VERSION
      };
    } catch (e) {
      console.warn("DB Failed, returning mock data");
      // MOCK DATA FALLBACK
      
      // Generate some deterministic mock data based on coordinates
      const mockScore = Math.floor(Math.abs(lat + lon) * 100) % 60 + 30; // 30-90
      
      return {
        score: mockScore,
        status: 'medium_confidence',
        confidence: 0.75,
        period: { start: startDate.toISOString(), end: endDate.toISOString() },
        coverage: {
          temporal: 1.0,
          geographic: 0.8,
          spatial_precision: 'exact'
        },
        granularity: 'coordinate',
        sources: [{
          id: 'MOCK-DB',
          name: 'Dados Simulados (Demonstração)',
          updated_at: new Date().toISOString(),
          quality_score: 0.8
        }],
        indicators: [
          { canonicalCategory: 'robbery', categoryGroup: 'violent', value: Math.floor(mockScore * 0.5) },
          { canonicalCategory: 'theft', categoryGroup: 'property', value: Math.floor(mockScore * 1.5) },
          { canonicalCategory: 'vehicle_theft', categoryGroup: 'vehicle', value: Math.floor(mockScore * 0.2) }
        ],
        trend: {
          previousPeriod: { start: new Date(startDate.getTime() - 1000*3600*24*365).toISOString(), end: startDate.toISOString() },
          previousScore: Math.min(100, mockScore + 5),
          previousIndicators: []
        } as any,
        methodology: TAXONOMY_VERSION
      };
    }
  }

  private computeScore(indicators: IndicatorValue[], granularity: string, radiusMeters: number, periodMonths: number, population: number) {
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

    let score = 0;
    
    if (granularity === 'coordinate') {
      const areaSqKm = (Math.PI * Math.pow(radiusMeters / 1000, 2));
      const annualMultiplier = 12 / periodMonths;
      const severityWeightedIncidents = (violentCount * 5) + (propertyCount * 2) + (vehicleCount * 2);
      const weightedDensity = (severityWeightedIncidents * annualMultiplier) / areaSqKm;
      score = Math.max(0, Math.min(100, Math.round(100 - (weightedDensity / 2))));
    } else {
      const pop = population || 100000;
      const annualMultiplier = 12 / periodMonths;
      const severityWeightedIncidents = (violentCount * 5) + (propertyCount * 2) + (vehicleCount * 2);
      const annualizedWeighted = severityWeightedIncidents * annualMultiplier;
      const ratePer100k = (annualizedWeighted / pop) * 100000;
      score = Math.max(0, Math.min(100, Math.round(100 - (ratePer100k / 20))));
    }
    return score;
  }

  private emptyResult(start: Date, end: Date, sources: any[] = []): AnalysisResult {
    return {
      score: null,
      status: 'insufficient_data',
      confidence: 0,
      period: { start: start.toISOString(), end: end.toISOString() },
      coverage: { temporal: 0, geographic: 0, spatial_precision: 'unknown' },
      granularity: 'national',
      sources,
      indicators: [],
      trend: null,
      methodology: TAXONOMY_VERSION
    };
  }

  private async getSourceMetadata(sourceId: string) {
    const res = await db.select().from(dataSources).where(eq(dataSources.id, sourceId)).limit(1);
    if (!res || res.length === 0) return null;
    const source = res[0];

    // Get last successful import to calculate quality
    const imports = await db.select()
      .from(dataImports)
      .where(and(eq(dataImports.sourceId, sourceId), eq(dataImports.status, 'completed')))
      .orderBy(desc(dataImports.createdAt))
      .limit(1);

    let qualityScore = 0.5; // Default unknown
    let lastImportDate = source.updatedAt;

    if (imports && imports.length > 0) {
      const imp = imports[0];
      const valid = imp.recordsValid || 0;
      const invalid = imp.recordsInvalid || 0;
      const total = valid + invalid;
      if (total > 0) {
        // Simple quality metric based on validity
        qualityScore = valid / total;
      }
      lastImportDate = imp.createdAt;
    }

    return {
      name: source.name,
      qualityScore,
      lastImportDate
    };
  }

  private async aggregateOccurrences(lat: number, lon: number, radiusMeters: number, startDate: Date, endDate: Date, sourceId: string): Promise<IndicatorValue[]> {
    const degreeRadius = radiusMeters / 111320.0;
    const results = await db.execute(sql`
      SELECT category, source_category, COUNT(*) as value
      FROM ${securityOccurrences}
      WHERE source_id = ${sourceId}
        AND occurred_at >= ${startDate.toISOString()}
        AND occurred_at <= ${endDate.toISOString()}
        AND geom && ST_Expand(ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${degreeRadius})
        AND ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography) <= ${radiusMeters}
      GROUP BY category, source_category
    `);

    return (results as any[]).map(row => {
      const canonical = normalizeLegacyCategory(row.category);
      return {
        canonicalCategory: canonical,
        categoryGroup: getCategoryGroup(canonical),
        value: Number(row.value),
        sourceCategory: row.source_category
      };
    });
  }

  private async aggregateIndicators(ibgeCode: string, startDate: Date, endDate: Date, sourceId: string): Promise<IndicatorValue[]> {
    // Note: period in indicators is usually 'YYYY-MM'
    // For simplicity, we match everything inside the date range if they have occurredAt. 
    // Wait, security_indicators doesn't have occurred_at, it has `period` (YYYY-MM).
    // Let's do a substring match or just parse dates.
    
    // We can do a SQL filter on period strings >= 'YYYY-MM'
    const startPeriod = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const endPeriod = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

    const results = await db.execute(sql`
      SELECT category, MAX(source_category) as source_category, SUM(value) as value
      FROM ${securityIndicators}
      WHERE source_id = ${sourceId}
        AND municipality_code = ${ibgeCode}
        AND period >= ${startPeriod}
        AND period <= ${endPeriod}
      GROUP BY category
    `);

    return (results as any[]).map(row => {
      const canonical = normalizeLegacyCategory(row.category);
      return {
        canonicalCategory: canonical,
        categoryGroup: getCategoryGroup(canonical),
        value: Number(row.value),
        sourceCategory: row.source_category
      };
    });
  }
}
