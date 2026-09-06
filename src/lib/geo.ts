export function getBoundingBox(lat: number, lon: number, radiusMeters: number) {
  const earthRadius = 6371000; // meters
  
  // Coordinate offsets in radians
  const latDelta = radiusMeters / earthRadius;
  const lonDelta = radiusMeters / (earthRadius * Math.cos((Math.PI * lat) / 180));
  
  return {
    minLat: lat - (latDelta * 180) / Math.PI,
    maxLat: lat + (latDelta * 180) / Math.PI,
    minLon: lon - (lonDelta * 180) / Math.PI,
    maxLon: lon + (lonDelta * 180) / Math.PI,
  };
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in meters
}
