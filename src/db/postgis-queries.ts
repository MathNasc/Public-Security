import { sql } from "drizzle-orm";

export function spatialFilter(lon: number, lat: number, radiusMeters: number, geomColumn = 'geom') {
  // PostGIS spatial filter utilizing GiST index on Geometry and ST_Distance on Geography for accuracy
  // We compute an approximate degree radius for the bounding box index check
  const degreeRadius = radiusMeters / 111320.0;
  
  return sql`
    ${sql.raw(geomColumn)} && ST_Expand(ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${degreeRadius})
    AND ST_Distance(
      ${sql.raw(geomColumn)}::geography,
      ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography
    ) <= ${radiusMeters}
  `;
}
