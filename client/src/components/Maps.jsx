import { useEffect, useRef, useState } from 'react';
import { Circle, CircleMarker, MapContainer, ScaleControl, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { Check, Layers, LoaderCircle, LocateFixed, Maximize2, Minimize2, Search, X } from 'lucide-react';
import { usePrefs } from '../context/PrefsContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { categoryLabel } from '../utils/format';

export const DEFAULT_CENTER = [28.6692, 77.4538]; // Ghaziabad

const CAT_COLOR = { road: '#ea580c', garbage: '#65a30d', water: '#0284c7', streetlight: '#ca8a04', drainage: '#7c3aed', other: '#64748b' };

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO = `${OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>`;
// Free tile services; all require attribution, none require an API key.
export const BASEMAPS = {
  streets: { label: 'Streets', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM, maxZoom: 19 },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    labels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
  },
  terrain: { label: 'Terrain', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: `${OSM}, SRTM | &copy; <a href="https://opentopomap.org">OpenTopoMap</a>`, maxZoom: 17 },
  light: { label: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: CARTO, maxZoom: 20 },
  dark: { label: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: CARTO, maxZoom: 20 },
};
const CHOICES = [['auto', 'Default'], ...Object.entries(BASEMAPS).map(([k, v]) => [k, v.label])];

function useBasemap() {
  const [choice, setChoice] = useState(() => { try { return localStorage.getItem('basemap') || 'auto'; } catch { return 'auto'; } });
  const { theme } = useTheme();
  const pick = (c) => { setChoice(c); try { localStorage.setItem('basemap', c); } catch { /* ignore */ } };
  const key = choice === 'auto' ? (theme === 'dark' ? 'dark' : 'streets') : choice;
  return { choice, key, pick };
}

function Tiles({ baseKey }) {
  const { lite } = usePrefs();
  if (lite) return null; // Lite mode: no tiles, the heaviest download on the page
  const b = BASEMAPS[baseKey];
  return (
    <>
      <TileLayer key={baseKey} url={b.url} attribution={b.attribution} maxZoom={b.maxZoom} detectRetina />
      {b.labels && <TileLayer key={`${baseKey}-labels`} url={b.labels} maxZoom={b.maxZoom} />}
    </>
  );
}

function MapRef({ onReady }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

const ctrl = 'flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-700 shadow-[0_2px_8px_-2px_rgb(15_23_42/0.25)] transition hover:bg-white hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900/95 dark:text-slate-200 dark:hover:text-brand-500';

/**
 * Map shell shared by every map in the app: style switcher, locate-me, fullscreen, zoom, optional search.
 * Children are rendered inside the Leaflet map.
 */
function MapFrame({ center, zoom = 13, height, children, search = false, onSearchPick, onLocate, scrollWheelZoom = true, label = 'Map' }) {
  const { choice, key, pick } = useBasemap();
  const { lite } = usePrefs();
  const [map, setMap] = useState(null);
  const [menu, setMenu] = useState(false);
  const [full, setFull] = useState(false);
  const [me, setMe] = useState(null);
  const [locating, setLocating] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => map?.invalidateSize(), 50); return () => clearTimeout(t); }, [map, full]);
  useEffect(() => {
    if (!full) return undefined;
    const esc = (e) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [full]);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  const locate = () => {
    if (!navigator.geolocation || !map) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition((p) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
      setMe(pos);
      map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
      onLocate?.(pos);
      setLocating(false);
    }, () => setLocating(false), { enableHighAccuracy: true, timeout: 10000 });
  };

  return (
    <div className={`relative isolate overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 ${full ? 'map-fullscreen' : ''}`} style={{ height: full ? undefined : height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%' }} scrollWheelZoom={scrollWheelZoom || full} zoomControl={false} aria-label={label}>
        <MapRef onReady={setMap} />
        <Tiles baseKey={key} />
        <ScaleControl position="bottomleft" imperial={false} />
        {me && <Circle center={[me.lat, me.lng]} radius={Math.min(me.acc, 200)} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.12 }} />}
        {me && <CircleMarker center={[me.lat, me.lng]} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}><Tooltip>You are here</Tooltip></CircleMarker>}
        {children}
      </MapContainer>

      {search && <MapSearch map={map} onPick={onSearchPick} />}

      <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2">
        <div className="relative" ref={menuRef}>
          <button type="button" className={ctrl} onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label="Map style" title="Map style"><Layers className="h-4 w-4" aria-hidden /></button>
          {menu && (
            <div role="menu" aria-label="Map style" className="absolute right-11 top-0 w-40 animate-pop rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-[0_12px_32px_-12px_rgb(15_23_42/0.35)] dark:border-ink-700 dark:bg-ink-900">
              {CHOICES.map(([k, l]) => (
                <button key={k} type="button" role="menuitemradio" aria-checked={choice === k} onClick={() => { pick(k); setMenu(false); }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-ink-800 ${choice === k ? 'font-semibold text-brand-700 dark:text-brand-500' : ''}`}>
                  {l}{choice === k && <Check className="h-4 w-4" aria-hidden />}
                </button>
              ))}
              {lite && <p className="px-2.5 pt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-300">Lite mode hides map tiles to save data</p>}
            </div>
          )}
        </div>
        <button type="button" className={ctrl} onClick={locate} aria-label="Show my location" title="My location">
          {locating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <LocateFixed className="h-4 w-4" aria-hidden />}
        </button>
        <button type="button" className={ctrl} onClick={() => setFull((f) => !f)} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen (Esc)' : 'Full screen'}>
          {full ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
        </button>
        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-[0_2px_8px_-2px_rgb(15_23_42/0.25)] dark:border-ink-700 dark:bg-ink-900/95">
          <button type="button" className="h-9 w-9 text-lg font-semibold text-slate-700 transition hover:text-brand-700 dark:text-slate-200" onClick={() => map?.zoomIn()} aria-label="Zoom in">+</button>
          <span className="mx-2 h-px bg-slate-200 dark:bg-ink-700" aria-hidden />
          <button type="button" className="h-9 w-9 text-lg font-semibold text-slate-700 transition hover:text-brand-700 dark:text-slate-200" onClick={() => map?.zoomOut()} aria-label="Zoom out">−</button>
        </div>
      </div>
    </div>
  );
}

function MapSearch({ map, onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return undefined; }
    const t = setTimeout(() => {
      setBusy(true);
      api('/geo/search', { query: { q } }).then(({ data }) => setResults(data)).catch(() => setResults([])).finally(() => setBusy(false));
    }, 500);
    return () => clearTimeout(t);
  }, [q]);
  const choose = (r) => {
    map?.flyTo([r.lat, r.lng], 17, { duration: 0.8 });
    onPick?.({ lat: r.lat, lng: r.lng, label: r.label });
    setResults([]);
    setQ(r.label.split(',').slice(0, 2).join(','));
  };
  return (
    <div className="absolute left-3 right-16 top-3 z-[500] max-w-sm">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 shadow-[0_2px_8px_-2px_rgb(15_23_42/0.25)] dark:border-ink-700 dark:bg-ink-900/95">
        {busy ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden /> : <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place or landmark" aria-label="Search the map"
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (results[0]) choose(results[0]); } }} />
        {q && <button type="button" onClick={() => { setQ(''); setResults([]); }} aria-label="Clear search" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="h-4 w-4" aria-hidden /></button>}
      </div>
      {results.length > 0 && (
        <ul className="mt-1 max-h-60 animate-pop overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-[0_12px_32px_-12px_rgb(15_23_42/0.35)] dark:border-ink-700 dark:bg-ink-900" role="listbox" aria-label="Search results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" role="option" aria-selected="false" onClick={() => choose(r)} className="block w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-ink-800">{r.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat != null) map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.6 }); }, [lat, lng, map]);
  return null;
}

// Pick the issue location: click the map, search a place, or use "my location".
export function MapPicker({ value, onChange, height = 340 }) {
  const center = value ? [value.lat, value.lng] : null;
  return (
    <MapFrame center={center || DEFAULT_CENTER} height={height} search label="Pick the issue location"
      onSearchPick={(p) => onChange({ lat: p.lat, lng: p.lng }, 'search')} onLocate={(p) => onChange({ lat: p.lat, lng: p.lng }, 'gps')}>
      <ClickToPick onPick={(p) => onChange(p, 'map')} />
      <Recenter lat={value?.lat} lng={value?.lng} />
      {center && (
        <>
          <CircleMarker center={center} radius={18} pathOptions={{ color: '#14b8a6', weight: 0, fillOpacity: 0.18 }} />
          <CircleMarker center={center} radius={9} pathOptions={{ color: '#fff', fillColor: '#0f766e', fillOpacity: 1, weight: 3 }}><Tooltip>Issue location</Tooltip></CircleMarker>
        </>
      )}
    </MapFrame>
  );
}

// Read-only map of many points, coloured by category, with optional recurrence hotspots.
export function PointsMap({ points = [], hotspots = [], height = 380, center, onPointClick }) {
  const c = center || (points[0] ? [points[0].lat, points[0].lng] : DEFAULT_CENTER);
  return (
    <MapFrame center={c} zoom={12} height={height} scrollWheelZoom={false} label="Map of reported issues">
      {points.map((p, i) => (
        <CircleMarker key={p.id || i} center={[p.lat, p.lng]} radius={p.priority === 'critical' || p.priority === 'high' ? 8 : 6}
          eventHandlers={onPointClick ? { click: () => onPointClick(p) } : undefined}
          pathOptions={{ color: '#fff', weight: 1.5, fillColor: CAT_COLOR[p.category] || '#64748b', fillOpacity: 0.85 }}>
          <Tooltip>{p.title ? `${p.title} · ` : ''}{categoryLabel(p.category)}{p.status ? ` · ${p.status.replace('_', ' ')}` : ''}</Tooltip>
        </CircleMarker>
      ))}
      {/* recurrence hotspots: ring size grows with the number of repeat reports */}
      {hotspots.map((h) => (
        <CircleMarker key={`h${h.lat},${h.lng},${h.category}`} center={[h.lat, h.lng]} radius={10 + Math.min(20, h.count * 2)}
          pathOptions={{ color: '#dc2626', weight: 2, fillColor: '#ef4444', fillOpacity: 0.15, dashArray: '4 4' }}>
          <Tooltip>Hotspot: {h.count} × {categoryLabel(h.category)}</Tooltip>
        </CircleMarker>
      ))}
    </MapFrame>
  );
}

export function MapLegend() {
  return (
    <ul className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
      {Object.entries(CAT_COLOR).map(([k, color]) => (
        <li key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-ink-900" style={{ background: color }} />{categoryLabel(k)}</li>
      ))}
    </ul>
  );
}
