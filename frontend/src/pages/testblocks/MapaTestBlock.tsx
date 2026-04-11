import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { testblockService } from "@/services/testblock";
import type { MapaPosicion } from "@/types/testblock";

/* ── Fix Leaflet default icon paths for Vite bundler ─────────────── */
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/* ── Color map for position estados ──────────────────────────────── */
const ESTADO_COLOR: Record<string, string> = {
  alta: "#22c55e",       // green-500
  baja: "#f87171",       // red-400
  vacia: "#ffffff",      // white
  replante: "#3b82f6",   // blue-500
  protegida: "#f97316",  // orange-500
  polinizante: "#f97316",
};

const ESTADO_BORDER: Record<string, string> = {
  alta: "#15803d",
  baja: "#b91c1c",
  vacia: "#9ca3af",
  replante: "#1d4ed8",
  protegida: "#c2410c",
  polinizante: "#c2410c",
};

/* ── Props ───────────────────────────────────────────────────────── */
interface MapaTestBlockProps {
  testblockId: number;
  variedadNames: Record<number, string>;
}

export function MapaTestBlock({ testblockId, variedadNames }: MapaTestBlockProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["testblocks", testblockId, "mapa"],
    queryFn: () => testblockService.getMapa(testblockId),
    enabled: !!testblockId,
  });

  /* ── Initialize / update map ───────────────────────────────────── */
  useEffect(() => {
    if (!data || !mapContainerRef.current) return;
    if (!data.latitud || !data.longitud) return;

    const lat = Number(data.latitud);
    const lng = Number(data.longitud);
    const zoom = data.zoom_nivel || 18;

    // Destroy previous map instance if any
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom,
      attributionControl: true,
    });
    mapRef.current = map;

    // Satellite tile layer (ESRI World Imagery)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxZoom: 22,
      },
    ).addTo(map);

    // Optional street labels overlay for readability
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 22,
      },
    ).addTo(map);

    // Draw boundary polygon if available
    if (data.poligono_coords && data.poligono_coords.length > 0) {
      L.polygon(data.poligono_coords as L.LatLngExpression[], {
        color: "#facc15",
        weight: 2,
        fillOpacity: 0.08,
        dashArray: "6 4",
      }).addTo(map);
    }

    // Center marker
    L.marker([lat, lng]).addTo(map).bindPopup("Centro del TestBlock");

    // Draw position markers as CircleMarkers
    if (data.posiciones && data.posiciones.length > 0) {
      const posGroup = L.layerGroup();

      // Simple grid layout: offset positions from center based on hilera/posicion
      // Using a small offset in degrees (~0.00003 ~ 3m between positions)
      const OFFSET = 0.00003;

      // Find max hilera/posicion to center the grid
      const hileras = data.posiciones.map((p: MapaPosicion) => p.hilera);
      const posiciones = data.posiciones.map((p: MapaPosicion) => p.posicion);
      const midH = (Math.min(...hileras) + Math.max(...hileras)) / 2;
      const midP = (Math.min(...posiciones) + Math.max(...posiciones)) / 2;

      for (const pos of data.posiciones) {
        const posLat = lat + (pos.hilera - midH) * OFFSET;
        const posLng = lng + (pos.posicion - midP) * OFFSET;

        const estado = pos.estado || "vacia";
        const fillColor = ESTADO_COLOR[estado] || ESTADO_COLOR.vacia;
        const borderColor = ESTADO_BORDER[estado] || ESTADO_BORDER.vacia;

        const varName = pos.id_variedad
          ? variedadNames[pos.id_variedad] || `#${pos.id_variedad}`
          : "-";

        const circle = L.circleMarker([posLat, posLng], {
          radius: 6,
          fillColor,
          color: borderColor,
          weight: 1.5,
          fillOpacity: 0.9,
        });

        circle.bindPopup(
          `<div style="font-size:12px;line-height:1.5">
            <strong>H${pos.hilera} - P${pos.posicion}</strong><br/>
            Estado: <b>${estado}</b><br/>
            Variedad: ${varName}<br/>
            <span style="color:#888">${pos.codigo_unico}</span>
          </div>`,
        );

        posGroup.addLayer(circle);
      }

      posGroup.addTo(map);
    }

    // Force a size recalculation after render
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [data, variedadNames]);

  /* ── No coordinates configured ─────────────────────────────────── */
  if (!isLoading && data && (!data.latitud || !data.longitud)) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex flex-col items-center justify-center text-center py-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-14 w-14 text-muted-foreground/30 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h4 className="font-semibold text-sm mb-1">Mapa no disponible</h4>
          <p className="text-sm text-muted-foreground max-w-md">
            Configure las coordenadas del testblock (latitud y longitud) para ver el mapa satelital.
          </p>
        </div>
      </div>
    );
  }

  /* ── Loading ───────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-muted-foreground">Cargando mapa...</span>
        </div>
      </div>
    );
  }

  /* ── Error ──────────────────────────────────────────────────────── */
  if (isError) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-red-500">Error al cargar datos del mapa: {(error as Error)?.message}</span>
        </div>
      </div>
    );
  }

  /* ── Map with legend ───────────────────────────────────────────── */
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b text-xs text-muted-foreground bg-gray-50/50">
        <span className="font-medium text-foreground mr-1">Leyenda:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 border border-green-700 inline-block" /> Alta
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-400 border border-red-700 inline-block" /> Baja
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-white border border-gray-400 inline-block" /> Vacia
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 border border-blue-700 inline-block" /> Replante
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-500 border border-orange-700 inline-block" /> Polinizante
        </span>
      </div>

      {/* Map container */}
      <div
        ref={mapContainerRef}
        style={{ height: 520, width: "100%" }}
      />
    </div>
  );
}
