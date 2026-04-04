import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon (webpack/vite strips default paths)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface MapPin {
  id: number | string;
  lat: number;
  lng: number;
  label: string;
  detail?: string;
  onClick?: () => void;
}

interface MapViewProps {
  pins: MapPin[];
  height?: string;
  zoom?: number;
}

/** Default center: central Chile (-34.5, -71.2) */
const DEFAULT_CENTER: [number, number] = [-34.5, -71.2];
const DEFAULT_ZOOM = 7;

export function MapView({ pins, height = "450px", zoom }: MapViewProps) {
  const validPins = useMemo(
    () => pins.filter((p) => p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng)),
    [pins],
  );

  const center = useMemo<[number, number]>(() => {
    if (validPins.length === 0) return DEFAULT_CENTER;
    const avgLat = validPins.reduce((s, p) => s + p.lat, 0) / validPins.length;
    const avgLng = validPins.reduce((s, p) => s + p.lng, 0) / validPins.length;
    return [avgLat, avgLng];
  }, [validPins]);

  const effectiveZoom = zoom ?? (validPins.length <= 1 ? 12 : DEFAULT_ZOOM);

  if (validPins.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted/30 rounded-lg border text-muted-foreground text-sm"
        style={{ height }}
      >
        No hay ubicaciones con coordenadas para mostrar en el mapa.
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={effectiveZoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validPins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            eventHandlers={pin.onClick ? { click: pin.onClick } : undefined}
          >
            <Popup>
              <div className="text-sm">
                <strong>{pin.label}</strong>
                {pin.detail && <p className="text-muted-foreground mt-1">{pin.detail}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
