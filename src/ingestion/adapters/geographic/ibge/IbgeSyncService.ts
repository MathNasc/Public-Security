import { db } from '../../../../db/index';
import { geographicStates, geographicMunicipalities } from '../../../../db/schema';
import { GeoNormalizationService } from '../../../../services/GeoNormalizationService';

export class IbgeSyncService {
  
  async syncAll() {
    console.log("[IBGE SYNC] Starting IBGE Geographic Sync...");

    try {
      // 1. Sync States
      console.log("[IBGE SYNC] Fetching states from IBGE API...");
      const statesResponse = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados');
      if (!statesResponse.ok) throw new Error("Failed to fetch states from IBGE");
      const states = await statesResponse.json();

      console.log(`[IBGE SYNC] Found ${states.length} states. Upserting into DB...`);
      
      const statesToInsert = states.map((s: any) => ({
        code: String(s.id),
        acronym: s.sigla,
        name: s.nome,
        region: s.regiao?.nome || 'Unknown',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      for (const s of statesToInsert) {
        // Simple UPSERT via INSERT OR REPLACE/IGNORE handled individually
        await db.insert(geographicStates).values(s).onConflictDoNothing({ target: geographicStates.code });
      }

      // 2. Sync Municipalities
      console.log("[IBGE SYNC] Fetching municipalities from IBGE API...");
      const muniResponse = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
      if (!muniResponse.ok) throw new Error("Failed to fetch municipalities from IBGE");
      const municipalities = await muniResponse.json();

      console.log(`[IBGE SYNC] Found ${municipalities.length} municipalities. Upserting into DB...`);

      const CHUNK_SIZE = 500;
      for (let i = 0; i < municipalities.length; i += CHUNK_SIZE) {
        const chunk = municipalities.slice(i, i + CHUNK_SIZE);
        
        const muniValues = chunk.map((m: any) => ({
          code: String(m.id),
          stateCode: String(m.microrregiao?.mesorregiao?.UF?.id || '0'),
          stateAcronym: String(m.microrregiao?.mesorregiao?.UF?.sigla || 'XX'),
          name: m.nome,
          normalizedName: GeoNormalizationService.normalizeText(m.nome),
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        await db.insert(geographicMunicipalities).values(muniValues).onConflictDoNothing({ target: geographicMunicipalities.code });
      }

      console.log("[IBGE SYNC] Sync completed successfully!");
      return { success: true, states: states.length, municipalities: municipalities.length };

    } catch (error: any) {
      console.error("[IBGE SYNC] Sync failed:", error);
      throw error;
    }
  }
}
