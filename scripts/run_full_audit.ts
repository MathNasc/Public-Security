import fs from 'fs';
import { loadSharedStrings, streamSheet } from './audit_spdados.js';

// Convert Excel Serial Date to YYYY-MM-DD
function excelDateToISO(serial: string): string {
  const num = parseFloat(serial);
  if (isNaN(num) || num <= 0) return serial;
  // Excel epoch begins Dec 30 1899 due to 1900 leap year bug
  const date = new Date(Math.round((num - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

async function runAudit() {
  console.log('=== STARTING SSP-SP SPDADOSCRIMINAIS AUDIT ===');
  const xlsxPath = 'data/temp/SPDadosCriminais_2026.xlsx';
  const sharedStrings = await loadSharedStrings(xlsxPath);

  // Stats structures
  let totalRows = 0;
  const boSet = new Set<string>();
  const boYearSet = new Set<string>();
  const boNaturezaSet = new Set<string>();
  const boDelegaciaSet = new Set<string>();
  const boToRows = new Map<string, number>();
  const boToNaturezas = new Map<string, Set<string>>();
  const boToRubricas = new Map<string, Set<string>>();

  // Temporal
  let countFactMatchesStatMonth = 0;
  let countFactDiffStatMonth = 0;
  let countFactDiffYear = 0;
  const factYearDist: Record<string, number> = {};
  const sampleTemporalDiffs: any[] = [];

  // Municipality
  let sameMunCount = 0;
  let diffMunCount = 0;
  const diffMunPairs: Record<string, number> = {};
  const ibgeDistinct = new Set<string>();
  const munDistinct = new Set<string>();
  const munCircunscricaoDistinct = new Set<string>();
  const munNullIbge: Record<string, number> = {};

  // Geo
  let geoValid = 0;
  let geoNull = 0;
  let geoZero = 0;
  let geoOutOfBounds = 0;
  const geoCoordsFreq = new Map<string, number>();
  const geoByMun: Record<string, { total: number; valid: number }> = {};

  // Rubrica & Natureza
  const naturezaDist: Record<string, number> = {};
  const rubricaDist: Record<string, number> = {};
  const rubricaToNatureza: Record<string, Set<string>> = {};

  // Aggregation comparison counters for July 2026
  // Key: munCircunscricao + "||" + naturezaApurada
  const munCatCount: Record<string, number> = {};
  const munCatBoDistinct: Record<string, Set<string>> = {};

  console.log('Streaming sheet3.xml (JUL-DEZ 2026)...');
  const startStream = Date.now();

  await streamSheet(
    xlsxPath,
    'xl/worksheets/sheet3.xml',
    sharedStrings,
    (rowNum, row, headers) => {
      totalRows++;
      const numBo = (row['NUM_BO'] || '').trim();
      const anoBo = (row['ANO_BO'] || '').trim();
      const delegacia = (row['NOME_DELEGACIA'] || '').trim();
      const munRegistro = (row['NOME_MUNICIPIO'] || '').trim();
      const munCirc = (row['NOME_MUNICIPIO_CIRCUNSCRICAO'] || '').trim();
      const ibge = (row['COD IBGE'] || '').trim();
      const dataRegSerial = (row['DATA_REGISTRO'] || '').trim();
      const dataOcorrSerial = (row['DATA_OCORRENCIA_BO'] || '').trim();
      const mesEstat = (row['MES_ESTATISTICA'] || '').trim();
      const anoEstat = (row['ANO_ESTATISTICA'] || '').trim();
      const rubrica = (row['RUBRICA'] || '').trim();
      const conduta = (row['DESCR_CONDUTA'] || '').trim();
      const natureza = (row['NATUREZA_APURADA'] || '').trim();
      const latStr = (row['LATITUDE'] || '').trim();
      const lonStr = (row['LONGITUDE'] || '').trim();

      // 1. Identity
      boSet.add(numBo);
      const boYearKey = `${numBo}__${anoBo}`;
      boYearSet.add(boYearKey);
      const boNatKey = `${numBo}__${anoBo}__${natureza}`;
      boNaturezaSet.add(boNatKey);
      const boDelKey = `${numBo}__${anoBo}__${delegacia}`;
      boDelegaciaSet.add(boDelKey);

      boToRows.set(boYearKey, (boToRows.get(boYearKey) || 0) + 1);
      if (!boToNaturezas.has(boYearKey)) boToNaturezas.set(boYearKey, new Set());
      boToNaturezas.get(boYearKey)!.add(natureza);
      if (!boToRubricas.has(boYearKey)) boToRubricas.set(boYearKey, new Set());
      boToRubricas.get(boYearKey)!.add(rubrica);

      // 2. Temporal
      const dataOcorrISO = excelDateToISO(dataOcorrSerial);
      const dataRegISO = excelDateToISO(dataRegSerial);
      const ocorrMonth = dataOcorrISO.length >= 7 ? parseInt(dataOcorrISO.split('-')[1], 10) : null;
      const ocorrYear = dataOcorrISO.length >= 4 ? dataOcorrISO.split('-')[0] : null;
      const statMonth = parseInt(mesEstat, 10);
      const statYear = anoEstat;

      if (ocorrYear) {
        factYearDist[ocorrYear] = (factYearDist[ocorrYear] || 0) + 1;
      }
      if (ocorrYear && ocorrYear !== statYear) {
        countFactDiffYear++;
      }
      if (ocorrMonth && ocorrMonth === statMonth && ocorrYear === statYear) {
        countFactMatchesStatMonth++;
      } else {
        countFactDiffStatMonth++;
        if (sampleTemporalDiffs.length < 5) {
          sampleTemporalDiffs.push({
            numBo,
            anoBo,
            dataOcorrISO,
            dataRegISO,
            mesEstat,
            anoEstat,
            natureza
          });
        }
      }

      // 3. Municipality
      if (munRegistro === munCirc) {
        sameMunCount++;
      } else {
        diffMunCount++;
        const pair = `${munRegistro} -> ${munCirc}`;
        diffMunPairs[pair] = (diffMunPairs[pair] || 0) + 1;
      }
      if (ibge && ibge !== 'NULL') ibgeDistinct.add(ibge);
      else munNullIbge[munCirc] = (munNullIbge[munCirc] || 0) + 1;

      munDistinct.add(munRegistro);
      munCircunscricaoDistinct.add(munCirc);

      // 4. Geo
      const lat = parseFloat(latStr.replace(',', '.'));
      const lon = parseFloat(lonStr.replace(',', '.'));

      if (!geoByMun[munCirc]) geoByMun[munCirc] = { total: 0, valid: 0 };
      geoByMun[munCirc].total++;

      if (!latStr || latStr === 'NULL' || !lonStr || lonStr === 'NULL' || isNaN(lat) || isNaN(lon)) {
        geoNull++;
      } else if (lat === 0 && lon === 0) {
        geoZero++;
      } else if (lat < -25.5 || lat > -19.5 || lon < -53.5 || lon > -44.0) {
        geoOutOfBounds++;
      } else {
        geoValid++;
        geoByMun[munCirc].valid++;
        const coordKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        geoCoordsFreq.set(coordKey, (geoCoordsFreq.get(coordKey) || 0) + 1);
      }

      // 5. Natureza / Rubrica
      naturezaDist[natureza] = (naturezaDist[natureza] || 0) + 1;
      rubricaDist[rubrica] = (rubricaDist[rubrica] || 0) + 1;
      if (!rubricaToNatureza[rubrica]) rubricaToNatureza[rubrica] = new Set();
      rubricaToNatureza[rubrica].add(natureza);

      // 6. Aggregation
      const aggKey = `${munCirc}||${mesEstat}||${natureza}`;
      munCatCount[aggKey] = (munCatCount[aggKey] || 0) + 1;
      if (!munCatBoDistinct[aggKey]) munCatBoDistinct[aggKey] = new Set();
      munCatBoDistinct[aggKey].add(boYearKey);
    }
  );

  console.log(`[Stream Finished] Processed ${totalRows} rows in ${((Date.now() - startStream) / 1000).toFixed(2)}s`);

  // Analyze BO Duplication
  let multiRowBos = 0;
  let multiNaturezaBos = 0;
  let multiRubricaBos = 0;
  const dupRowCounts: Record<number, number> = {};
  const sampleDupBos: any[] = [];

  for (const [boKey, count] of boToRows.entries()) {
    dupRowCounts[count] = (dupRowCounts[count] || 0) + 1;
    if (count > 1) {
      multiRowBos++;
      if (sampleDupBos.length < 5) {
        sampleDupBos.push({
          boKey,
          rowCount: count,
          naturezas: Array.from(boToNaturezas.get(boKey) || []),
          rubricas: Array.from(boToRubricas.get(boKey) || [])
        });
      }
    }
    if ((boToNaturezas.get(boKey)?.size || 0) > 1) {
      multiNaturezaBos++;
    }
    if ((boToRubricas.get(boKey)?.size || 0) > 1) {
      multiRubricaBos++;
    }
  }

  // Top duplicated coords
  const topCoords = Array.from(geoCoordsFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top Naturezas
  const sortedNaturezas = Object.entries(naturezaDist).sort((a, b) => b[1] - a[1]);
  // Top Rubricas
  const sortedRubricas = Object.entries(rubricaDist).sort((a, b) => b[1] - a[1]);
  // Top Municipality Diffs
  const sortedMunDiffs = Object.entries(diffMunPairs).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const results = {
    section1_identity: {
      totalRows,
      distinctNumBo: boSet.size,
      distinctBoYear: boYearSet.size,
      distinctBoNatureza: boNaturezaSet.size,
      distinctBoDelegacia: boDelegaciaSet.size,
      multiRowBos,
      multiRowBosPercent: ((multiRowBos / boYearSet.size) * 100).toFixed(2) + '%',
      multiNaturezaBos,
      multiNaturezaBosPercent: ((multiNaturezaBos / boYearSet.size) * 100).toFixed(2) + '%',
      multiRubricaBos,
      dupRowHistogram: dupRowCounts,
      sampleDupBos
    },
    section2_temporal: {
      countFactMatchesStatMonth,
      countFactMatchesPercent: ((countFactMatchesStatMonth / totalRows) * 100).toFixed(2) + '%',
      countFactDiffStatMonth,
      countFactDiffPercent: ((countFactDiffStatMonth / totalRows) * 100).toFixed(2) + '%',
      countFactDiffYear,
      countFactDiffYearPercent: ((countFactDiffYear / totalRows) * 100).toFixed(2) + '%',
      factYearDist,
      sampleTemporalDiffs
    },
    section3_municipality: {
      sameMunCount,
      sameMunPercent: ((sameMunCount / totalRows) * 100).toFixed(2) + '%',
      diffMunCount,
      diffMunPercent: ((diffMunCount / totalRows) * 100).toFixed(2) + '%',
      distinctIbgeCount: ibgeDistinct.size,
      distinctMunRegistroCount: munDistinct.size,
      distinctMunCircunscricaoCount: munCircunscricaoDistinct.size,
      sortedMunDiffs
    },
    section4_geo: {
      geoValid,
      geoValidPercent: ((geoValid / totalRows) * 100).toFixed(2) + '%',
      geoNull,
      geoNullPercent: ((geoNull / totalRows) * 100).toFixed(2) + '%',
      geoZero,
      geoZeroPercent: ((geoZero / totalRows) * 100).toFixed(2) + '%',
      geoOutOfBounds,
      geoOutOfBoundsPercent: ((geoOutOfBounds / totalRows) * 100).toFixed(2) + '%',
      topCoords
    },
    section5_categories: {
      distinctNaturezasCount: sortedNaturezas.length,
      topNaturezas: sortedNaturezas.slice(0, 15),
      distinctRubricasCount: sortedRubricas.length,
      topRubricas: sortedRubricas.slice(0, 15)
    },
    section6_samples: {
      sampleAggregates: Object.entries(munCatCount)
        .filter(([k]) => k.includes('S.PAULO') || k.includes('CAMPINAS') || k.includes('SANTOS'))
        .slice(0, 20)
        .map(([k, count]) => ({
          key: k,
          rowCount: count,
          distinctBos: munCatBoDistinct[k]?.size
        }))
    }
  };

  fs.writeFileSync('data/temp/audit_results_sheet3.json', JSON.stringify(results, null, 2));
  console.log('Audit results saved to data/temp/audit_results_sheet3.json');
}

runAudit().catch(console.error);
