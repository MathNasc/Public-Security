import { normalizeSspRecord } from '../../ssp/normalizer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BaseAdapter, DiscoveryResult, AdapterMetadata, ParsedRecord } from '../BaseAdapter';

export class SspSpAdapter extends BaseAdapter {
  async discover(): Promise<DiscoveryResult> {
    return {
      source: 'SSP-SP',
      dataset: 'ocorrencias_criminais',
      url: 'http://www.ssp.sp.gov.br/transparenciassp/',
      version: this.identifyVersion(),
      checksum: crypto.createHash('sha256').update('ssp-sp-version-mock').digest('hex')
    };
  }

  identifyVersion(): string {
    return '2024-01'; // Mocked
  }

  async download(destinationPath: string): Promise<string> {
    // In a real system, download from SSP-SP or use local fixture
    const fixturePath = path.join(process.cwd(), 'uploads/test_sp.csv');
    if (fs.existsSync(fixturePath)) {
      fs.copyFileSync(fixturePath, destinationPath);
    } else {
      fs.writeFileSync(destinationPath, "ANO_BO;NUM_BO;DELEGACIA_NOME\n2024;1;DEL TESTE"); // Dummy
    }
    return destinationPath;
  }

  metadata(): AdapterMetadata {
    return {
      name: 'Ocorrências Criminais - SSP/SP',
      agency: 'Secretaria da Segurança Pública do Estado de São Paulo',
      frequency: 'Mensal',
      coverage: 'Estadual (SP)',
      limitations: ['Possui coordenadas (embora imprecisas às vezes)', 'Altamente granular']
    };
  }

  parseRow(row: any): ParsedRecord | null {
    const normalized = normalizeSspRecord(row);
    if (!normalized) return null;
    return {
      target: 'occurrences',
      data: normalized
    };
  }
}
