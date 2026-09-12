/**
 * Motor de Identidade Canônica e Idempotência para Microdados da SSP-SP
 * Garante unicidade absoluta, rastreabilidade e idempotência no PostgreSQL/PostGIS.
 */
import crypto from 'crypto';

export interface SspOccurrenceIdentity {
  sourceId: 'SSP-SP';
  anoBo: number;
  numBo: string;
  delegaciaCircunscricao: string;
  naturezaApurada: string;
  rubrica: string;
  disambiguationIndex?: number;
  canonicalKey: string;
  sourceRecordId: string; // SHA-256 da chave canônica
}

export class SspIdentityService {
  /**
   * Converte a data de número serial do Excel (ou string ISO/BR) para Date válido.
   */
  static parseExcelOrDateString(val: any): { date: Date | null; year: number; month: number } {
    if (!val) {
      const now = new Date();
      return { date: null, year: now.getFullYear(), month: 1 };
    }

    // Caso 1: Serial numérico do Excel (ex.: 46039)
    const numVal = Number(val);
    if (!isNaN(numVal) && numVal > 30000 && numVal < 70000) {
      // 25569 = diferença de dias entre 1900-01-01 e 1970-01-01
      const utcDays = Math.floor(numVal - 25569);
      const utcValue = utcDays * 86400 * 1000;
      const d = new Date(utcValue);
      return {
        date: d,
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1
      };
    }

    // Caso 2: String de data DD/MM/YYYY ou YYYY-MM-DD
    const str = String(val).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          const dateObj = new Date(Date.UTC(y, m - 1, d));
          return { date: dateObj, year: y, month: m };
        }
      }
    } else if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
          const dateObj = new Date(Date.UTC(y, m - 1, d));
          return { date: dateObj, year: y, month: m };
        }
      }
    }

    const now = new Date();
    return { date: null, year: now.getFullYear(), month: 1 };
  }

  /**
   * Constrói a chave canônica rigorosa e determinística para uma linha de microdados da SSP-SP.
   */
  static buildIdentity(
    anoBoRaw: any,
    numBoRaw: any,
    delegaciaCircunscricaoRaw: any,
    naturezaApuradaRaw: any,
    rubricaRaw: any,
    disambiguationIndex: number = 0
  ): SspOccurrenceIdentity {
    const anoBo = parseInt(String(anoBoRaw || '0').replace(/\D/g, ''), 10) || new Date().getFullYear();
    const numBo = String(numBoRaw || '0').trim().toUpperCase();
    const delegaciaCircunscricao = String(delegaciaCircunscricaoRaw || 'NAO_INFORMADA')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const naturezaApurada = String(naturezaApuradaRaw || 'NAO_INFORMADA')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const rubrica = String(rubricaRaw || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    let canonicalKey = `SSP-SP:${anoBo}:${numBo}:${delegaciaCircunscricao}:${naturezaApurada}:${rubrica}`;
    if (disambiguationIndex > 0) {
      canonicalKey += `#VICTIM_${disambiguationIndex}`;
    }

    const sourceRecordId = crypto
      .createHash('sha256')
      .update(canonicalKey)
      .digest('hex');

    return {
      sourceId: 'SSP-SP',
      anoBo,
      numBo,
      delegaciaCircunscricao,
      naturezaApurada,
      rubrica,
      disambiguationIndex,
      canonicalKey,
      sourceRecordId
    };
  }

  /**
   * Validação de coordenadas territoriais (São Paulo e Brasil).
   * Coordenadas oficiais de SP: Lat (-25.5 a -19.5), Lon (-53.5 a -44.0).
   */
  static parseCoordinates(latRaw: any, lonRaw: any): { latitude: number | null; longitude: number | null; isValid: boolean } {
    if (!latRaw || !lonRaw) {
      return { latitude: null, longitude: null, isValid: false };
    }

    const latStr = String(latRaw).replace(',', '.').trim();
    const lonStr = String(lonRaw).replace(',', '.').trim();

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
      return { latitude: null, longitude: null, isValid: false };
    }

    // Bounds de SP ampliado (permite pequenas margens de fronteira)
    if (lat >= -26.0 && lat <= -19.0 && lon >= -54.0 && lon <= -43.0) {
      return { latitude: lat, longitude: lon, isValid: true };
    }

    // Bounds gerais do Brasil
    if (lat >= -35.0 && lat <= 6.0 && lon >= -75.0 && lon <= -30.0) {
      return { latitude: lat, longitude: lon, isValid: true };
    }

    return { latitude: null, longitude: null, isValid: false };
  }
}
