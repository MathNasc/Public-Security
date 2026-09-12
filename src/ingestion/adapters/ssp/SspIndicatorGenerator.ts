/**
 * Gerador de Indicadores Oficiais Derivados dos Microdados da SSP-SP
 * Calcula 'delitos_apurados' e 'boletins_distintos' agregados por município, código IBGE, categoria, ano e mês.
 */
import { db } from '../../../db/index.js';
import { securityIndicators, securityOccurrences } from '../../../db/schema.js';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface DerivedIndicatorSummary {
  municipalityCode: string;
  stateCode: string;
  category: string;
  subcategory: string;
  sourceCategory: string;
  period: string; // YYYY-MM
  delitosApurados: number;
  boletinsDistintos: number;
}

export class SspIndicatorGenerator {
  /**
   * Agrega os microdados armazenados na tabela `security_occurrences` para o estado de SP
   * e gera os indicadores canônicos em `security_indicators`.
   */
  static async generateIndicatorsFromOccurrences(year?: number): Promise<{
    delitosGenerated: number;
    boletinsGenerated: number;
    municipalitiesCovered: number;
  }> {
    console.log(`[SspIndicatorGenerator] Iniciando agregação de indicadores derivados ${year ? `para o ano ${year}` : 'para todos os anos'}...`);

    // Consulta agregada direta agrupando por município, categoria, subcategoria e período
    const yearFilter = year ? sql`AND o.year = ${year}` : sql``;

    // 1. Agregação de Delitos Apurados (contagem total de linhas/fatos)
    // 2. Agregação de Boletins Distintos (contagem de BOs únicos)
    const aggregatedRows = await db.all(sql`
      SELECT 
        o.municipality_code as municipalityCode,
        o.state_code as stateCode,
        o.category as category,
        COALESCE(o.subcategory, 'geral') as subcategory,
        COALESCE(o.source_category, o.category) as sourceCategory,
        printf('%04d-%02d', o.year, o.month) as period,
        COUNT(*) as delitosApurados,
        COUNT(DISTINCT json_extract(o.source_data, '$.NUM_BO')) as boletinsDistintos
      FROM security_occurrences o
      WHERE o.source_id = 'SSP-SP' ${yearFilter}
      GROUP BY 
        o.municipality_code,
        o.state_code,
        o.category,
        COALESCE(o.subcategory, 'geral'),
        COALESCE(o.source_category, o.category),
        o.year,
        o.month
    `) as any[];

    console.log(`[SspIndicatorGenerator] Encontrados ${aggregatedRows.length} grupos agregados de microdados.`);

    const uniqueMunis = new Set<string>();
    let delitosCount = 0;
    let boletinsCount = 0;

    const indicatorsToInsert: any[] = [];

    for (const row of aggregatedRows) {
      const muniCode = row.municipalityCode || '3550308'; // Default para Capital se nulo
      uniqueMunis.add(muniCode);

      // Indicador 1: Delitos Apurados (ocorrências/linhas de fato)
      indicatorsToInsert.push({
        id: crypto.randomUUID(),
        sourceId: 'SSP-SP',
        datasetId: 'indicadores_ssp_microdados',
        stateCode: row.stateCode || 'SP',
        municipalityCode: muniCode,
        category: row.category,
        subcategory: `${row.subcategory}:delitos_apurados`,
        sourceCategory: row.sourceCategory,
        period: row.period,
        value: Number(row.delitosApurados || 0),
        unit: 'delitos',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      delitosCount++;

      // Indicador 2: Boletins Distintos (BOs únicos registrados)
      indicatorsToInsert.push({
        id: crypto.randomUUID(),
        sourceId: 'SSP-SP',
        datasetId: 'indicadores_ssp_microdados',
        stateCode: row.stateCode || 'SP',
        municipalityCode: muniCode,
        category: row.category,
        subcategory: `${row.subcategory}:boletins_distintos`,
        sourceCategory: row.sourceCategory,
        period: row.period,
        value: Number(row.boletinsDistintos || row.delitosApurados || 0),
        unit: 'boletins',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      boletinsCount++;
    }

    // Persistência em lotes de 1.000
    const BATCH_SIZE = 1000;
    for (let i = 0; i < indicatorsToInsert.length; i += BATCH_SIZE) {
      const chunk = indicatorsToInsert.slice(i, i + BATCH_SIZE);
      await db.insert(securityIndicators).values(chunk).onConflictDoUpdate({
        target: [
          securityIndicators.sourceId,
          securityIndicators.stateCode,
          securityIndicators.municipalityCode,
          securityIndicators.category,
          securityIndicators.subcategory,
          securityIndicators.period
        ],
        set: {
          value: sql`excluded.value`,
          updatedAt: new Date()
        }
      });
    }

    console.log(`[SspIndicatorGenerator] Persistência concluída: ${indicatorsToInsert.length} registros inseridos/atualizados em ${uniqueMunis.size} municípios.`);

    return {
      delitosGenerated: delitosCount,
      boletinsGenerated: boletinsCount,
      municipalitiesCovered: uniqueMunis.size
    };
  }
}
