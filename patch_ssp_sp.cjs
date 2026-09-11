const fs = require('fs');

const path = 'src/ingestion/adapters/ssp/SspSpAdapter.ts';
let code = fs.readFileSync(path, 'utf8');

const target = `  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    // O CSV do SSP costuma ter colunas como:
    // Municipio, Natureza, Ano, Mes, Total
    
    const records: ParsedRecord[] = [];
    
    // Dicionário de padronização
    const crimeMapping: Record<string, string> = {
      'HOMICÍDIO DOLOSO (2)': 'homicidio',
      'HOMICÍDIO CULPOSO POR ACIDENTE DE TRÂNSITO': 'homicidio_transito',
      'LATROCÍNIO': 'latrocinio',
      'ROUBO - OUTROS': 'roubo',
      'ROUBO DE VEÍCULO': 'roubo_veiculo',
      'FURTO - OUTROS': 'furto',
      'FURTO DE VEÍCULO': 'furto_veiculo',
      'ESTUPRO': 'estupro'
    };`;

const replacement = `  parseRow(row: any): ParsedRecord[] | ParsedRecord | null {
    const records: ParsedRecord[] = [];
    
    // Dicionário de padronização (SSP-SP Real)
    const crimeMapping: Record<string, string> = {
      'HOMICÍDIO DOLOSO (2)': 'homicide',
      'HOMICÍDIO DOLOSO': 'homicide',
      'HOMICÍDIO CULPOSO POR ACIDENTE DE TRÂNSITO': 'traffic_homicide',
      'LATROCÍNIO': 'robbery_with_death',
      'ROUBO - OUTROS': 'robbery',
      'ROUBO A BANCO': 'bank_robbery',
      'ROUBO DE CARGA': 'cargo_robbery',
      'ROUBO DE VEÍCULO': 'vehicle_robbery',
      'FURTO - OUTROS': 'theft',
      'FURTO DE VEÍCULO': 'vehicle_theft',
      'ESTUPRO': 'rape',
      'ESTUPRO DE VULNERÁVEL': 'statutory_rape'
    };`;

code = code.replace(target, replacement);

const target2 = `    const natureza = row['Natureza'] || row['natureza'] || '';
    const total = parseInt(row['Total'] || row['total'] || '0', 10);
    
    if (isNaN(total) || total === 0) return null;

    const standardizedCategory = crimeMapping[natureza.toUpperCase().trim()] || 'outros';
    const ano = row['Ano'] || row['ano'];
    const mes = row['Mes'] || row['mes'] || row['Mês'];
    
    const periodStr = \`\${ano}-\${String(mes).padStart(2, '0')}\`;
    
    records.push({
      target: 'indicators',
      data: {
        id: crypto.randomUUID(),
        sourceId: 'SSP-SP',
        stateCode: 'SP',
        municipalityCode: row['Municipio'] || 'SP_Desconhecido',
        category: standardizedCategory,
        sourceCategory: natureza,
        period: periodStr,
        value: total,
        unit: 'ocorrencias'
      }
    });

    return records;
  }`;

const replacement2 = `    const natureza = row['Natureza'] || row['NATUREZA'] || row['natureza'] || '';
    if (!natureza) return null;

    const standardizedCategory = crimeMapping[natureza.toUpperCase().trim()] || 'other';
    const municipioStr = row['Município'] || row['Municipio'] || row['MUNICÍPIO'] || row['municipio'] || row['Cidade'] || 'SP_Desconhecido';
    
    // Remove accents and uppercase to standardise
    const municipio = municipioStr.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase();
    const ano = row['Ano'] || row['ANO'] || row['ano'] || new Date().getFullYear();

    // Mapping months from Portuguese columns
    const meses = [
      { key: 'Janeiro', num: '01' }, { key: 'Fevereiro', num: '02' }, { key: 'Março', num: '03' },
      { key: 'Abril', num: '04' }, { key: 'Maio', num: '05' }, { key: 'Junho', num: '06' },
      { key: 'Julho', num: '07' }, { key: 'Agosto', num: '08' }, { key: 'Setembro', num: '09' },
      { key: 'Outubro', num: '10' }, { key: 'Novembro', num: '11' }, { key: 'Dezembro', num: '12' }
    ];

    // Check if it's the flattened format (with 'Mês' and 'Total' columns)
    const mesAchatado = row['Mês'] || row['Mes'] || row['mes'] || row['MES'];
    if (mesAchatado) {
       const total = parseInt(row['Total'] || row['total'] || '0', 10);
       if (!isNaN(total) && total > 0) {
         let mm = mesAchatado;
         // convert string month to number if needed
         const foundMonth = meses.find(m => m.key.toLowerCase() === mesAchatado.toLowerCase());
         if (foundMonth) mm = foundMonth.num;
         
         const periodStr = \`\${ano}-\${String(mm).padStart(2, '0')}\`;
         records.push({
           target: 'indicators',
           data: {
             id: crypto.randomUUID(),
             sourceId: 'ssp-sp',
             datasetId: 'indicadores_municipais_estado',
             stateCode: 'SP',
             municipalityCode: null, // Let the worker resolve this using muniCache (or IBGE lookup)
             municipalityName: municipio,
             category: standardizedCategory,
             sourceCategory: natureza,
             period: periodStr,
             value: total,
             unit: 'occurrences'
           }
         });
       }
    } else {
       // Format with columns for each month: "Janeiro", "Fevereiro", etc.
       for (const m of meses) {
          const valRaw = row[m.key] || row[m.key.toUpperCase()] || row[m.key.toLowerCase()];
          if (valRaw !== undefined && valRaw !== null && valRaw !== '') {
             const total = parseInt(valRaw, 10);
             if (!isNaN(total) && total > 0) {
                const periodStr = \`\${ano}-\${m.num}\`;
                records.push({
                   target: 'indicators',
                   data: {
                     id: crypto.randomUUID(),
                     sourceId: 'ssp-sp',
                     datasetId: 'indicadores_municipais_estado',
                     stateCode: 'SP',
                     municipalityCode: null, 
                     municipalityName: municipio,
                     category: standardizedCategory,
                     sourceCategory: natureza,
                     period: periodStr,
                     value: total,
                     unit: 'occurrences'
                   }
                });
             }
          }
       }
    }

    return records;
  }`;

code = code.replace(target2, replacement2);

fs.writeFileSync('patch_ssp_sp2.cjs', code);
