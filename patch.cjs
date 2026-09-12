const fs = require('fs');
let code = fs.readFileSync('src/ingestion/parsers/SinespParser.ts', 'utf8');

code = code.replace(
`        const uf = row['UF'] || row['Sigla UF'];
        if (!uf) continue;
        
        const crimeRaw = row['Tipo Crime'] || row['Natureza'] || row['Crime'];
        if (!crimeRaw) continue;
        
        const mesStr = (row['Mês'] || row['Mes'] || 'janeiro').toString().toLowerCase();
        const ano = parseInt(row['Ano'] || new Date().getFullYear().toString());
        const vitimas = parseInt(row['Vítimas'] || row['Ocorrências'] || '0') || 0;`,
`        const uf = (row['UF'] || row['Sigla UF'] || row['uf'])?.toString();
        if (!uf) continue;
        
        const crimeRaw = (row['Tipo Crime'] || row['Natureza'] || row['Crime'] || row['evento'])?.toString();
        if (!crimeRaw) continue;
        
        let mesStr = (row['Mês'] || row['Mes'] || 'janeiro').toString().toLowerCase();
        let ano = parseInt(row['Ano'] || new Date().getFullYear().toString());
        
        const dataRef = row['data_referencia'];
        if (dataRef) {
           let dt;
           if (dataRef instanceof Date) dt = dataRef;
           else if (typeof dataRef === 'number') {
              dt = new Date((dataRef - 25569) * 86400 * 1000); 
           } else {
              dt = new Date(dataRef.toString());
           }
           if (!isNaN(dt.getTime())) {
              ano = dt.getFullYear();
              const mesesMap = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
              mesStr = mesesMap[dt.getMonth()];
           }
        }
        
        const vitimas = parseInt(row['Vítimas'] || row['Ocorrências'] || row['total_vitima'] || '0') || 0;`
);

fs.writeFileSync('src/ingestion/parsers/SinespParser.ts', code);
