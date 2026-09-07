export interface RawCrimeRecord {
  source_record_id: string;
  category: string;
  subcategory: string;
  sourceCategory: string;
  occurred_at: string | null; // ISO date or null
  latitude: number | null;
  longitude: number | null;
  location_precision: "exact" | "approximate" | "neighborhood" | "district" | "unknown";
  original_address: string | null;
}

export function normalizeSspRecord(raw: any): RawCrimeRecord {
  // 1. Extract Address for potential geocoding
  const logradouro = raw['LOGRADOURO'] || raw['logradouro'] || '';
  const numero = raw['NUMERO_LOGRADOURO'] || raw['numero_logradouro'] || raw['NUMERO'] || '';
  const bairro = raw['BAIRRO'] || raw['bairro'] || '';
  const cidade = raw['CIDADE'] || raw['cidade'] || raw['MUNICIPIO'] || '';
  
  let original_address = null;
  if (logradouro) {
    original_address = logradouro;
    if (numero && numero.toString().toLowerCase() !== 's/n' && numero.toString().trim() !== '0') {
      original_address += `, ${numero}`;
    }
    if (bairro) original_address += ` - ${bairro}`;
    if (cidade) original_address += ` - ${cidade}`;
  }

  // 2. Safely extract coordinates
  let latStr = raw['LATITUDE'] || raw['latitude'] || '';
  let lonStr = raw['LONGITUDE'] || raw['longitude'] || '';
  latStr = latStr.toString().replace(',', '.');
  lonStr = lonStr.toString().replace(',', '.');
  
  let lat = parseFloat(latStr);
  let lon = parseFloat(lonStr);
  
  if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
    lat = null;
    lon = null;
  }

  // 3. Parse date and time
  const dataOccStr = raw['DATAOCORRENCIA'] || raw['DATA_OCORRENCIA'] || raw['data'] || '';
  const horaOccStr = raw['HORAOCORRENCIA'] || raw['HORA_OCORRENCIA'] || raw['hora'] || '';
  
  let finalDateStr = null;
  if (dataOccStr) {
    let dateObj = new Date();
    if (dataOccStr.includes('/')) {
      const [day, month, year] = dataOccStr.split('/');
      const [hour, minute] = (horaOccStr || '00:00').split(':');
      dateObj = new Date(
        parseInt(year), 
        parseInt(month) - 1, 
        parseInt(day), 
        parseInt(hour || '0'), 
        parseInt(minute || '0')
      );
    } else if (dataOccStr.includes('-')) {
      const cleanDate = dataOccStr.split(' ')[0];
      dateObj = new Date(`${cleanDate}T${horaOccStr || '00:00:00'}.000Z`);
    } else {
      dateObj = new Date(dataOccStr);
    }
    
    if (!isNaN(dateObj.getTime())) {
      finalDateStr = dateObj.toISOString();
    }
  }

  // 4. Nature of occurrence
  const natureza = (raw['RUBRICA'] || raw['NATUREZA_APURADA'] || raw['natureza'] || 'Outros').toString().trim();
  const desdobramento = (raw['DESDOBRAMENTO'] || raw['DESCRICAO_LOCAL'] || '').toString().trim();
  
  // Categorize
  let category = "Outros";
  const naturezaLower = natureza.toLowerCase();
  if (naturezaLower.includes("roubo")) {
    if (naturezaLower.includes("veículo") || naturezaLower.includes("veiculo")) category = "Crimes relacionados a veículos";
    else category = "Crimes contra pessoas";
  } else if (naturezaLower.includes("furto")) {
    if (naturezaLower.includes("veículo") || naturezaLower.includes("veiculo")) category = "Crimes relacionados a veículos";
    else category = "Crimes contra pessoas";
  } else if (naturezaLower.includes("homicídio") || naturezaLower.includes("latrocínio")) {
    category = "Crimes violentos";
  }

  // 5. Determine Source ID
  const sourceRecordId = raw['NUM_BO'] || raw['BO_NUMERO'] || raw['id'] || `SSP-${Date.now()}-${Math.random()}`;

  // 6. Location Precision
  let precision: "exact" | "approximate" | "neighborhood" | "district" | "unknown" = "unknown";
  if (lat !== null && lon !== null) {
    precision = "exact"; // If it came from DB with lat/lon, assume exact for now
  }

  return {
    source_record_id: sourceRecordId,
    category: category,
    subcategory: natureza + (desdobramento ? ` - ${desdobramento}` : ''),
    sourceCategory: natureza,
    occurred_at: finalDateStr,
    latitude: lat,
    longitude: lon,
    location_precision: precision,
    original_address: original_address
  };
}
