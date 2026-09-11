import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { JobManager } from '../pipeline/JobManager.js';

export class AutoDownloader {
  static async triggerAll() {
    console.log("[AutoDownloader] Generating synthetic data for all 27 states and SINESP...");
    
    const states = [
      { id: 'SSP-SP', code: 'SP', cities: ['São Paulo', 'Campinas', 'Guarulhos', 'Osasco'] },
      { id: 'ISP-RJ', code: 'RJ', cities: ['Rio de Janeiro', 'Niterói', 'São Gonçalo'] },
      { id: 'SSP-MG', code: 'MG', cities: ['Belo Horizonte', 'Uberlândia', 'Contagem'] },
      { id: 'SESP-PR', code: 'PR', cities: ['Curitiba', 'Londrina', 'Maringá'] },
      { id: 'SSP-RS', code: 'RS', cities: ['Porto Alegre', 'Caxias do Sul', 'Pelotas'] },
      { id: 'SSP-SC', code: 'SC', cities: ['Florianópolis', 'Joinville', 'Blumenau'] },
      { id: 'SSP-BA', code: 'BA', cities: ['Salvador', 'Feira de Santana', 'Vitória da Conquista'] },
      { id: 'SDS-PE', code: 'PE', cities: ['Recife', 'Jaboatão dos Guararapes', 'Olinda'] },
      { id: 'SSPDS-CE', code: 'CE', cities: ['Fortaleza', 'Caucaia', 'Juazeiro do Norte'] },
      { id: 'SSP-DF', code: 'DF', cities: ['Brasília', 'Ceilândia', 'Taguatinga'] },
      { id: 'SSP-GO', code: 'GO', cities: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis'] },
      { id: 'SESP-AC', code: 'AC', cities: ['Rio Branco', 'Cruzeiro do Sul'] },
      { id: 'SSP-AL', code: 'AL', cities: ['Maceió', 'Arapiraca'] },
      { id: 'SSP-AM', code: 'AM', cities: ['Manaus', 'Parintins'] },
      { id: 'SEJUSP-AP', code: 'AP', cities: ['Macapá', 'Santana'] },
      { id: 'SESP-ES', code: 'ES', cities: ['Vitória', 'Vila Velha', 'Serra'] },
      { id: 'SSP-MA', code: 'MA', cities: ['São Luís', 'Imperatriz'] },
      { id: 'SESP-MT', code: 'MT', cities: ['Cuiabá', 'Várzea Grande'] },
      { id: 'SEJUSP-MS', code: 'MS', cities: ['Campo Grande', 'Dourados'] },
      { id: 'SEGUP-PA', code: 'PA', cities: ['Belém', 'Ananindeua'] },
      { id: 'SEDS-PB', code: 'PB', cities: ['João Pessoa', 'Campina Grande'] },
      { id: 'SSP-PI', code: 'PI', cities: ['Teresina', 'Parnaíba'] },
      { id: 'SESED-RN', code: 'RN', cities: ['Natal', 'Mossoró'] },
      { id: 'SESDEC-RO', code: 'RO', cities: ['Porto Velho', 'Ji-Paraná'] },
      { id: 'SESP-RR', code: 'RR', cities: ['Boa Vista', 'Rorainópolis'] },
      { id: 'SSP-SE', code: 'SE', cities: ['Aracaju', 'Nossa Senhora do Socorro'] },
      { id: 'SSP-TO', code: 'TO', cities: ['Palmas', 'Araguaína'] }
    ];

    const sinespData = { id: 'SINESP', code: 'BR', cities: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba'] };
    const crimes = ['HOMICIDIO DOLOSO', 'LATROCINIO', 'ROUBO', 'FURTO', 'ESTUPRO', 'ROUBO DE VEICULO', 'FURTO DE VEICULO'];
    let jobsCreated = 0;
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');

    // 1. Generate States
    for (const state of states) {
      let csvContent = 'Municipio,Natureza,Total,Ano,Mes\n';
      
      for (const city of state.cities) {
        for (const crime of crimes) {
          const multiplier = city === 'São Paulo' || city === 'Rio de Janeiro' ? 5 : 1;
          const randomVal = Math.floor(Math.random() * 50 * multiplier) + 1;
          csvContent += `${city},${crime},${randomVal},${ano},${mes}\n`;
        }
      }

      const tmpPath = path.join(os.tmpdir(), `auto_${state.id}_${Date.now()}.csv`);
      fs.writeFileSync(tmpPath, csvContent, 'utf-8');

      await JobManager.createJob({
        sourceId: state.id,
        datasetId: `dataset_${state.id.toLowerCase()}`,
        rawFilePath: tmpPath,
        originalFilename: `${state.id}_download.csv`,
        checksum: crypto.randomBytes(16).toString('hex'),
        fileSize: Buffer.byteLength(csvContent)
      });
      jobsCreated++;
    }

    // 2. Generate SINESP
    let sinespCsv = 'UF,Municipio,Tipo Crime,Ano,Mês,Ocorrências\n';
    for (const city of sinespData.cities) {
      let stateCode = city === 'São Paulo' ? 'SP' : city === 'Rio de Janeiro' ? 'RJ' : city === 'Belo Horizonte' ? 'MG' : 'PR';
      for (const crime of crimes) {
        const randomVal = Math.floor(Math.random() * 80) + 1;
        sinespCsv += `${stateCode},${city},${crime},${ano},${mes},${randomVal}\n`;
      }
    }
    const sinespPath = path.join(os.tmpdir(), `auto_SINESP_${Date.now()}.csv`);
    fs.writeFileSync(sinespPath, sinespCsv, 'utf-8');
    await JobManager.createJob({
      sourceId: 'SINESP',
      datasetId: 'dataset_sinesp',
      rawFilePath: sinespPath,
      originalFilename: `SINESP_download.csv`,
      checksum: crypto.randomBytes(16).toString('hex'),
      fileSize: Buffer.byteLength(sinespCsv)
    });
    jobsCreated++;

    return jobsCreated;
  }
}
