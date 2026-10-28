import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { categoryLabel } from '../utils/format';

export const DEFAULT_CENTER = [28.6692, 77.4538]; // Ghaziabad

const CAT_COLOR = { road: '#ea580c', garbage: '#65a30d', water: '#0284c7', streetlight: '#ca8a04', drainage: '#7c3aed', other: '#64748b' };

function Tiles() {
  return <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />;
}

function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, Math.max(map.getZoom(), 15)); }, [center, map]);
  return null;
}

// Click on the map to set the issue location.
export function MapPicker({ value, onChange, height = 320 }) {
  const center = value ? [value.lat, value.lng] : null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700" style={{ height }}>
      <MapContainer center={center || DEFAULT_CENTER} zoom={13} style={{ height: '100%' }} scrollWheelZoom>
        <Tiles />
        <ClickToPick onPick={onChange} />
        <Recenter center={center} />
        {center && <CircleMarker center={center} radius={10} pathOptions={{ color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.8, weight: 3 }} />}
      </MapContainer>
    </div>
  );
}

// Read-only map of many points, coloured by category.
export function PointsMap({ points = [], height = 380, center }) {
  const c = center || (points[0] ? [points[0].lat, points[0].lng] : DEFAULT_CENTER);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800" style={{ height }}>
      <MapContainer center={c} zoom={12} style={{ height: '100%' }} scrollWheelZoom={false}>
        <Tiles />
        {points.map((p, i) => (
          <CircleMarker key={i} center={[p.lat, p.lng]} radius={p.priority === 'critical' || p.priority === 'high' ? 8 : 6}
            pathOptions={{ color: CAT_COLOR[p.category] || '#64748b', fillOpacity: 0.55, weight: 1 }}>
            <Tooltip>{categoryLabel(p.category)}{p.status ? ` · ${p.status.replace('_', ' ')}` : ''}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export function MapLegend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
      {Object.entries(CAT_COLOR).map(([k, color]) => (
        <li key={k} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{categoryLabel(k)}</li>
      ))}
    </ul>
  );
}
