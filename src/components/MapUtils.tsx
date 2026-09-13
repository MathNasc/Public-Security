import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for leaflet default icons
try {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
} catch {
  // ignore
}

// Defensively patch L.DomUtil to prevent "Cannot read properties of undefined (reading '_leaflet_pos')"
try {
  const originalGetPosition = L.DomUtil.getPosition;
  L.DomUtil.getPosition = function (el: any) {
    if (!el) {
      return new L.Point(0, 0);
    }
    try {
      if (originalGetPosition) {
        const pos = originalGetPosition.call(L.DomUtil, el);
        return pos || el._leaflet_pos || new L.Point(0, 0);
      }
      return el._leaflet_pos || new L.Point(0, 0);
    } catch {
      return new L.Point(0, 0);
    }
  };

  const originalSetPosition = L.DomUtil.setPosition;
  L.DomUtil.setPosition = function (el: any, point: any) {
    if (!el) return;
    try {
      if (originalSetPosition) {
        originalSetPosition.call(L.DomUtil, el, point);
      } else {
        el._leaflet_pos = point;
      }
    } catch {
      // ignore
    }
  };
} catch {
  // ignore
}

export function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    const lat = Number(center?.[0]);
    const lon = Number(center?.[1]);
    if (isNaN(lat) || isNaN(lon) || !isFinite(lat) || !isFinite(lon)) return;

    try {
      // Safely check if container exists before operating
      const container = map.getContainer();
      if (!container) return;

      map.invalidateSize();
      map.setView([lat, lon], zoom, { animate: false });
    } catch {
      // ignore
    }
  }, [center?.[0], center?.[1], zoom, map]);

  return null;
}

