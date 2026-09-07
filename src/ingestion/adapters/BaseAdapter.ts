export interface DiscoveryResult {
  source: string;
  dataset: string;
  url: string;
  version: string;
  checksum: string;
}

export interface AdapterMetadata {
  name: string;
  agency: string;
  frequency: string;
  coverage: string;
  limitations: string[];
}

export interface ParsedRecord {
  target: 'occurrences' | 'indicators';
  data: any;
}

export abstract class BaseAdapter {
  abstract discover(): Promise<DiscoveryResult>;
  abstract download(destinationPath: string): Promise<string>;
  abstract identifyVersion(): string;
  abstract metadata(): AdapterMetadata;
  abstract parseRow(row: any): ParsedRecord[] | ParsedRecord | null;
}
