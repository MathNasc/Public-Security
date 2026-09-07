import fs from 'fs';
const file = 'src/ingestion/pipeline/Worker.ts';
let code = fs.readFileSync(file, 'utf8');

const oldTryBlockStart = code.indexOf('try {', code.indexOf('for await (const row of parser)'));
const oldTryBlockEnd = code.indexOf('} catch (err) {', oldTryBlockStart);

const newTryBlock = `try {
          let results = adapter.parseRow(row);
          if (!results) {
             metrics.recordsInvalid++;
             continue;
          }
          if (!Array.isArray(results)) results = [results];
          
          for (const result of results) {
            if (!result || !result.data) {
              metrics.recordsInvalid++;
              continue;
            }
            
            if (result.target === 'occurrences' && (!result.data.latitude || !result.data.longitude)) {
              metrics.recordsWithoutCoordinates++;
            }
            
            if (result.target === 'indicators' && result.data.municipalityName && !result.data.municipalityCode) {
              const normName = result.data.municipalityName.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
              const key = result.data.stateCode + '_' + normName;
              result.data.municipalityCode = this.muniCache.get(key) || null;
            }
            
            metrics.recordsValid++;
            batch.push(result);
            
            if (batch.length >= BATCH_SIZE) {
              await this.insertBatch(job.source_id, batch, metrics);
              batch = [];
              checkpoint = recordsRead;
              await this.saveProgress(job.id, checkpoint, metrics);
            }
          }
        `;

code = code.substring(0, oldTryBlockStart) + newTryBlock + code.substring(oldTryBlockEnd);
fs.writeFileSync(file, code);
