export interface DatasetMetadata {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'json' | 'pdf' | 'api' | 'xlsx';
  geographic_level: 'national' | 'state' | 'municipality' | 'granular';
  url: string;
  period_start?: Date;
  period_end?: Date;
  last_modified?: Date;
  checksum?: string;
}

export interface RawDataset {
  metadata: DatasetMetadata;
  data: any; // Can be a Buffer, string, or parsed JSON depending on format
}

export interface NormalizedRecord {
  source_record_id: string;
  country: string;
  state_code?: string;
  municipality_code?: string;
  category: string;
  subcategory?: string;
  occurred_at: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_precision?: "exact" | "approximate" | "neighborhood" | "district" | "unknown";
  original_address?: string | null;
  
  // For aggregated indicators (if geographic_level is not granular)
  is_aggregated_indicator?: boolean;
  value?: number;
  period_reference?: string; 
}

export interface ValidationResult {
  valid: boolean;
  total_records: number;
  valid_records: number;
  rejected_records: number;
  errors: string[];
}

export interface SecurityDataSource {
  id: string;
  name: string;
  provider: string;
  country: string;
  state?: string;
  update_frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'irregular';

  discover(): Promise<DatasetMetadata[]>;
  fetch(dataset: DatasetMetadata): Promise<RawDataset>;
  parse(data: RawDataset): Promise<NormalizedRecord[]>;
  validate(records: NormalizedRecord[]): ValidationResult;
}
