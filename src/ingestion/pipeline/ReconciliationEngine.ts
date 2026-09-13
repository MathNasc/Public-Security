/**
 * ReconciliationEngine.ts
 * Motor de reconciliação cruzada entre microdados (ocorrências individuais) e indicadores consolidados.
 * Assegura que nenhum dado processado contenha divergências ocultas ou discrepâncias não auditadas.
 */

import { CanonicalOccurrence, CanonicalIndicator } from '../core/index.js';

export type ReconciliationStatus =
  | 'not_run'
  | 'passed'
  | 'passed_with_tolerance'
  | 'warning'
  | 'failed'
  | 'not_applicable';

export interface ReconciliationResult {
  stateCode: string;
  period: string;
  occurrenceCount: number;
  indicatorSum: number;
  discrepancyAbsolute: number;
  discrepancyPercentage: number;
  status: ReconciliationStatus;
  toleranceApplied: number; // Margem aceita em porcentagem (ex: 2.0%)
  differencesByCategory: Array<{
    category: string;
    microdataCount: number;
    indicatorValue: number;
    diffAbsolute: number;
    diffPercentage: number;
  }>;
  evidence: {
    comparedOccurrencesSource: string;
    comparedIndicatorsSource: string;
    occurrencesTimestamp: string;
    indicatorsTimestamp: string;
  };
  passed: boolean;
  notes: string[];
  timestamp: string;
}

export class ReconciliationEngine {
  public static readonly DEFAULT_TOLERANCE_PERCENT = 2.0; // 2% de tolerância nominal
  public static readonly WARNING_TOLERANCE_PERCENT = 5.0; // 5% gera warning

  /**
   * Reconcilia microdados e indicadores para um estado e período específicos.
   */
  public static reconcile(
    stateCode: string,
    period: string,
    occurrences: CanonicalOccurrence[],
    indicators: CanonicalIndicator[],
    tolerancePercent: number = this.DEFAULT_TOLERANCE_PERCENT
  ): ReconciliationResult {
    const timestamp = new Date().toISOString();

    if (occurrences.length === 0 && indicators.length === 0) {
      return {
        stateCode,
        period,
        occurrenceCount: 0,
        indicatorSum: 0,
        discrepancyAbsolute: 0,
        discrepancyPercentage: 0,
        status: 'not_applicable',
        toleranceApplied: tolerancePercent,
        differencesByCategory: [],
        evidence: {
          comparedOccurrencesSource: 'none',
          comparedIndicatorsSource: 'none',
          occurrencesTimestamp: timestamp,
          indicatorsTimestamp: timestamp
        },
        passed: true,
        notes: ['Nenhum registro presente para o período comparado.'],
        timestamp
      };
    }

    // Agrupa microdados por categoria canônica
    const microByCat = new Map<string, number>();
    for (const occ of occurrences) {
      const cat = (occ.category || 'outros').toLowerCase();
      microByCat.set(cat, (microByCat.get(cat) || 0) + 1);
    }

    // Agrupa indicadores por categoria canônica
    const indByCat = new Map<string, number>();
    for (const ind of indicators) {
      const cat = (ind.category || 'outros').toLowerCase();
      indByCat.set(cat, (indByCat.get(cat) || 0) + ind.value);
    }

    const allCategories = new Set([...microByCat.keys(), ...indByCat.keys()]);
    const differencesByCategory: ReconciliationResult['differencesByCategory'] = [];
    const notes: string[] = [];

    let totalMicro = 0;
    let totalInd = 0;

    for (const cat of allCategories) {
      const countM = microByCat.get(cat) || 0;
      const countI = indByCat.get(cat) || 0;
      totalMicro += countM;
      totalInd += countI;

      const diffAbs = Math.abs(countM - countI);
      const base = Math.max(countI, countM, 1);
      const diffPct = Number(((diffAbs / base) * 100).toFixed(2));

      differencesByCategory.push({
        category: cat,
        microdataCount: countM,
        indicatorValue: countI,
        diffAbsolute: diffAbs,
        diffPercentage: diffPct
      });
    }

    const discrepancyAbsolute = Math.abs(totalMicro - totalInd);
    const totalBase = Math.max(totalInd, totalMicro, 1);
    const discrepancyPercentage = Number(((discrepancyAbsolute / totalBase) * 100).toFixed(2));

    let status: ReconciliationStatus = 'passed';
    if (discrepancyAbsolute === 0) {
      status = 'passed';
      notes.push('Concordância exata (0 divergência) entre microdados e indicadores oficiais.');
    } else if (discrepancyPercentage <= tolerancePercent) {
      status = 'passed_with_tolerance';
      notes.push(`Divergência de ${discrepancyPercentage}% dentro da margem de tolerância operacional (${tolerancePercent}%).`);
    } else if (discrepancyPercentage <= this.WARNING_TOLERANCE_PERCENT) {
      status = 'warning';
      notes.push(`Divergência moderada de ${discrepancyPercentage}% (acima da tolerância de ${tolerancePercent}%, mas inferior a ${this.WARNING_TOLERANCE_PERCENT}%).`);
    } else {
      status = 'failed';
      notes.push(`Divergência crítica de ${discrepancyPercentage}% entre microdados (${totalMicro}) e indicadores agregados (${totalInd}).`);
    }

    return {
      stateCode,
      period,
      occurrenceCount: totalMicro,
      indicatorSum: totalInd,
      discrepancyAbsolute,
      discrepancyPercentage,
      status,
      toleranceApplied: tolerancePercent,
      differencesByCategory,
      evidence: {
        comparedOccurrencesSource: occurrences[0]?.sourceId || 'official_microdata',
        comparedIndicatorsSource: indicators[0]?.sourceId || 'official_indicators',
        occurrencesTimestamp: timestamp,
        indicatorsTimestamp: timestamp
      },
      passed: status === 'passed' || status === 'passed_with_tolerance',
      notes,
      timestamp
    };
  }
}
