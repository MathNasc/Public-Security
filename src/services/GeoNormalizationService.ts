import { db } from '../db/index.js';
import { geographicStates, geographicMunicipalities } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';

export class GeoNormalizationService {
  
  /**
   * Normalizes a string by removing accents, special characters, and lowercasing.
   */
  static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "") // Keep only alphanumeric and spaces
      .trim();
  }

  /**
   * Tries to find the official IBGE municipality code and name from a given dirty string.
   */
  async findMunicipality(dirtyName: string, stateAcronym?: string) {
    const normalized = GeoNormalizationService.normalizeText(dirtyName);
    
    if (!normalized) return null;

    if (stateAcronym) {
      const stateNorm = stateAcronym.trim().toUpperCase();
      const result = await db.query.geographicMunicipalities.findFirst({
        where: (m, { and, eq }) => and(
          eq(m.normalizedName, normalized),
          eq(m.stateAcronym, stateNorm)
        )
      });
      return result || null;
    } else {
      // Find the first match if state is not provided (can lead to collisions for common names like 'Bom Jesus')
      const result = await db.query.geographicMunicipalities.findFirst({
        where: (m, { eq }) => eq(m.normalizedName, normalized)
      });
      return result || null;
    }
  }

  async findStateByAcronym(acronym: string) {
    const stateNorm = acronym.trim().toUpperCase();
    return await db.query.geographicStates.findFirst({
      where: (s, { eq }) => eq(s.acronym, stateNorm)
    }) || null;
  }
}
