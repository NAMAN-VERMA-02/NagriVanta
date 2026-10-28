import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, ScaleControl, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { Check, Copy, Flame, Focus, Layers, LoaderCircle, LocateFixed, MapPin, Maximize2, Minimize2, Search, Shapes, X } from 'lucide-react';
import { usePrefs } from '../context/PrefsContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { categoryLabel, CATEGORIES, STATUS } from '../utils/format';
import { loadLeafletPlugins } from './leafletPlugins';

export const DEFAULT_CENTER = [28.6692, 77.4538]; // Ghaziabad

const CAT_COLOR = { road: '#ea580c', garbage: '#65a30d', water: '#0284c7', streetlight: '#ca8a04', drainage: '#7c3aed', other: '#64748b' };
const PRIORITY_WEIGHT = { low: 0.4, medium: 0.6, high: 0.85, critical: 1 };

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
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

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
      <TileLayer key={baseKey} url={b.url} attribution={b.attribution} maxZoom={b.maxZoom} maxNativeZoom={b.maxZoom} />
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
 * `cooperative` maps sit inside scrolling pages, so the wheel scrolls the page and Ctrl/⌘ + wheel zooms
 * (like embedded Google Maps). Children are rendered inside the Leaflet map; `overlay` floats top-left.
 */
function MapFrame({ center, zoom = 13, height, children, search = false, onSearchPick, onLocate, cooperative = false, label = 'Map', onMap, controls, overlay, bottom }) {
  const { choice, key, pick } = useBasemap();
  const { lite } = usePrefs();
  const [map, setMap] = useState(null);
  const [menu, setMenu] = useState(false);
  const [full, setFull] = useState(false);
  const [me, setMe] = useState(null);
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState(false);
  const menuRef = useRef(null);
  const wrapRef = useRef(null);

  const ready = useCallback((m) => { setMap(m); onMap?.(m); }, [onMap]);

  // Keep Leaflet's idea of its size in sync with the box (page animations, tabs, fullscreen, rotation).
  useEffect(() => {
    if (!map || !wrapRef.current) return undefined;
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [map]);

  // Native fullscreen where supported (escapes any transformed ancestor); CSS fallback otherwise (iPhone).
  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  useEffect(() => {
    if (!full || document.fullscreenElement) return undefined;
    const esc = (e) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [full]);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (!full && wrapRef.current?.requestFullscreen) wrapRef.current.requestFullscreen().catch(() => setFull(true));
    else setFull((f) => !f);
  };

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  // Cooperative wheel: a plain wheel scrolls the page and shows a hint; Ctrl/⌘ + wheel (or pinch) zooms.
  useEffect(() => {
    const el = wrapRef.current;
    if (!cooperative || full || !el) return undefined;
    let t;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) return;
      e.stopPropagation(); // capture phase: Leaflet never sees it, the page scrolls normally
      setHint(true);
      clearTimeout(t);
      t = setTimeout(() => setHint(false), 1400);
    };
    el.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => { el.removeEventListener('wheel', onWheel, { capture: true }); clearTimeout(t); };
  }, [cooperative, full]);

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
    <div ref={wrapRef} className={`relative isolate overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-ink-950 ${full ? 'map-fullscreen' : ''}`} style={{ height: full ? undefined : height }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%' }} scrollWheelZoom zoomControl={false} aria-label={label} worldCopyJump>
        <MapRef onReady={ready} />
        <Tiles baseKey={key} />
        <ScaleControl position="bottomleft" imperial={false} />
        {me && <Circle center={[me.lat, me.lng]} radius={Math.min(me.acc, 200)} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.12 }} />}
        {me && <CircleMarker center={[me.lat, me.lng]} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}><Tooltip>You are here</Tooltip></CircleMarker>}
        {children}
      </MapContainer>

      {search && <MapSearch map={map} onPick={onSearchPick} />}
      {overlay && <div className="pointer-events-none absolute left-3 right-16 top-3 z-[500] flex">{overlay}</div>}
      {bottom}

      <div className={`pointer-events-none absolute inset-0 z-[600] flex items-center justify-center bg-ink-950/45 transition-opacity duration-300 ${hint ? 'opacity-100' : 'opacity-0'}`} aria-hidden>
        <p className="rounded-full bg-ink-950/80 px-4 py-2 text-sm font-medium text-white">Use {IS_MAC ? '⌘' : 'Ctrl'} + scroll to zoom the map</p>
      </div>

      <div className="absolute right-3 top-3 z-[700] flex flex-col gap-2">
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
        {controls}
        <button type="button" className={ctrl} onClick={toggleFull} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen (Esc)' : 'Full screen'}>
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
  const [active, setActive] = useState(0);
  const [none, setNone] = useState(false);
  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); setNone(false); return undefined; }
    const t = setTimeout(() => {
      setBusy(true);
      api('/geo/search', { query: { q } })
        .then(({ data }) => { setResults(data); setActive(0); setNone(!data.length); })
        .catch(() => setResults([])).finally(() => setBusy(false));
    }, 450);
    return () => clearTimeout(t);
  }, [q]);
  const choose = (r) => {
    map?.flyTo([r.lat, r.lng], 17, { duration: 0.8 });
    onPick?.({ lat: r.lat, lng: r.lng, label: r.label });
    setResults([]);
    setNone(false);
    setQ(r.label.split(',').slice(0, 2).join(','));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
    if (e.key === 'Escape') setResults([]);
  };
  return (
    <div className="absolute left-3 right-16 top-3 z-[650] max-w-sm">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 shadow-[0_2px_8px_-2px_rgb(15_23_42/0.25)] dark:border-ink-700 dark:bg-ink-900/95">
        {busy ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden /> : <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place or landmark" aria-label="Search the map"
          role="combobox" aria-expanded={results.length > 0} aria-controls="map-search-results" aria-autocomplete="list"
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400" onKeyDown={onKey} />
        {q && <button type="button" onClick={() => { setQ(''); setResults([]); setNone(false); }} aria-label="Clear search" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="h-4 w-4" aria-hidden /></button>}
      </div>
      {results.length > 0 && (
        <ul id="map-search-results" className="mt-1 max-h-60 animate-pop overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-[0_12px_32px_-12px_rgb(15_23_42/0.35)] dark:border-ink-700 dark:bg-ink-900" role="listbox" aria-label="Search results">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" role="option" aria-selected={i === active} onClick={() => choose(r)} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left ${i === active ? 'bg-slate-100 dark:bg-ink-800' : ''}`}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />{r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {none && !busy && <p className="mt-1 animate-pop rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 dark:border-ink-700 dark:bg-ink-900">No places found. Try a landmark or locality name.</p>}
    </div>
  );
}

function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Fly to a location set from outside the map (GPS button, photo EXIF, pincode); moves made on the map don't trigger it.
function Recenter({ lat, lng, skip }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null) return;
    if (skip.current) { skip.current = false; return; }
    map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [lat, lng, map, skip]);
  return null;
}

const dropPin = L.divIcon({
  className: 'nv-drop-pin',
  html: '<svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true"><path d="M16 41s14-13.2 14-24.5A14 14 0 0 0 2 16.5C2 27.8 16 41 16 41Z" fill="#0f766e" stroke="#fff" stroke-width="2.5"/><circle cx="16" cy="16.5" r="5.5" fill="#fff"/></svg>',
  iconSize: [32, 42],
  iconAnchor: [16, 41],
});

// Pick the issue location: click the map, drag the pin, search a place, or use "my location".
export function MapPicker({ value, onChange, height = 340 }) {
  const center = value ? [value.lat, value.lng] : null;
  const fromMap = useRef(false);
  const [copied, setCopied] = useState(false);
  const set = (p, src) => { fromMap.current = src !== 'gps'; onChange(p, src); };
  const copy = () => {
    navigator.clipboard?.writeText(`${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <MapFrame center={center || DEFAULT_CENTER} height={height} search label="Pick the issue location"
      onSearchPick={(p) => set({ lat: p.lat, lng: p.lng }, 'search')} onLocate={(p) => set({ lat: p.lat, lng: p.lng }, 'gps')}
      bottom={value ? (
        <div className="absolute bottom-7 left-1/2 z-[500] flex -translate-x-1/2 animate-pop items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white/95 py-1 pl-3 pr-1 text-xs shadow-[0_2px_8px_-2px_rgb(15_23_42/0.25)] dark:border-ink-700 dark:bg-ink-900/95">
          <MapPin className="h-3.5 w-3.5 text-brand-600" aria-hidden />
          <span className="font-mono tabular-nums">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>
          <button type="button" onClick={copy} className="flex items-center gap-1 rounded-full px-2 py-1 font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-500 dark:hover:bg-ink-800" aria-label="Copy coordinates">
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : null}>
      <ClickToPick onPick={(p) => set(p, 'map')} />
      <Recenter lat={value?.lat} lng={value?.lng} skip={fromMap} />
      {center && (
        <>
          <CircleMarker center={center} radius={22} pathOptions={{ color: '#14b8a6', weight: 0, fillOpacity: 0.16 }} interactive={false} />
          <Marker position={center} icon={dropPin} draggable autoPan title="Drag to adjust the location"
            eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); set({ lat: ll.lat, lng: ll.lng }, 'map'); } }}>
            <Tooltip direction="top" offset={[0, -40]}>Drag to fine-tune</Tooltip>
          </Marker>
        </>
      )}
    </MapFrame>
  );
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function popupHtml(p, canOpen) {
  const color = CAT_COLOR[p.category] || CAT_COLOR.other;
  const meta = [p.status && (STATUS[p.status]?.label || p.status), p.priority && `${p.priority} priority`].filter(Boolean).join(' · ');
  return `<div class="nv-pop">
    <p class="nv-pop-cat"><i style="background:${color}"></i>${esc(categoryLabel(p.category))}</p>
    ${p.title ? `<p class="nv-pop-title">${esc(p.title)}</p>` : ''}
    ${meta ? `<p class="nv-pop-meta">${esc(meta)}</p>` : ''}
    ${p.ref ? `<p class="nv-pop-meta">${esc(p.ref)}</p>` : ''}
    ${canOpen ? '<button type="button" data-open class="nv-pop-btn">Open case →</button>' : ''}
  </div>`;
}

const pinIcon = (p) => {
  const big = p.priority === 'critical' || p.priority === 'high';
  const s = big ? 18 : 14;
  return L.divIcon({ className: 'nv-dot', html: `<span style="--c:${CAT_COLOR[p.category] || CAT_COLOR.other}"></span>`, iconSize: [s, s] });
};

const clusterIcon = (cluster) => {
  const n = cluster.getChildCount();
  const s = n < 10 ? 34 : n < 50 ? 42 : 52;
  return L.divIcon({ className: 'nv-cluster', html: `<span>${n}</span>`, iconSize: [s, s] });
};

// Imperative layer: clusters, plain pins or a heat layer, rebuilt when the data or mode changes.
function DataLayer({ points, mode, onPointClick }) {
  const map = useMap();
  const clickRef = useRef(onPointClick);
  useEffect(() => { clickRef.current = onPointClick; }, [onPointClick]);
  useEffect(() => {
    let layer;
    let cancelled = false;
    loadLeafletPlugins().then((PL) => {
      if (cancelled) return;
      if (mode === 'heat') {
        layer = PL.heatLayer(points.map((p) => [p.lat, p.lng, PRIORITY_WEIGHT[p.priority] ?? 0.6]), {
          radius: 26, blur: 20, maxZoom: 15, minOpacity: 0.3,
          gradient: { 0.25: '#2dd4bf', 0.5: '#facc15', 0.75: '#f97316', 1: '#dc2626' },
        });
      } else {
        layer = mode === 'cluster'
          ? PL.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48, spiderfyOnMaxZoom: true, iconCreateFunction: clusterIcon, chunkedLoading: true })
          : PL.featureGroup();
        for (const p of points) {
          const m = PL.marker([p.lat, p.lng], { icon: pinIcon(p), riseOnHover: true, keyboard: false });
          m.bindPopup(() => popupHtml(p, Boolean(clickRef.current && p.id)), { closeButton: false, className: 'nv-popup', offset: [0, -2], autoPanPadding: [60, 60] });
          m.on('popupopen', (e) => e.popup.getElement()?.querySelector('[data-open]')?.addEventListener('click', () => clickRef.current?.(p)));
          layer.addLayer(m);
        }
      }
      layer.addTo(map);
    });
    return () => { cancelled = true; if (layer) map.removeLayer(layer); };
  }, [map, points, mode]);
  return null;
}

const MODES = [['cluster', 'Clusters', Shapes], ['pins', 'Pins', MapPin], ['heat', 'Heat', Flame]];

// Map of many reports: clusters / pins / heat, category filters, recurrence hotspots, popups, fit-to-data.
export function PointsMap({ points = [], hotspots = [], height = 380, center, onPointClick, legend = true }) {
  const single = points.length <= 1 && !hotspots.length;
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('mapMode') || 'cluster'; } catch { return 'cluster'; } });
  const [hidden, setHidden] = useState(() => new Set());
  const [showHot, setShowHot] = useState(true);
  const [map, setMap] = useState(null);

  const pickMode = (m) => { setMode(m); try { localStorage.setItem('mapMode', m); } catch { /* ignore */ } };
  const visible = useMemo(() => points.filter((p) => !hidden.has(p.category)), [points, hidden]);
  const counts = useMemo(() => points.reduce((a, p) => ({ ...a, [p.category]: (a[p.category] || 0) + 1 }), {}), [points]);
  const hot = showHot ? hotspots.filter((h) => !hidden.has(h.category)) : [];

  const fit = useCallback(() => {
    if (!map) return;
    const ll = [...visible, ...hot].map((p) => [p.lat, p.lng]);
    if (center && single) map.setView(center, 16);
    else if (ll.length === 1) map.setView(ll[0], 16);
    else if (ll.length) map.fitBounds(ll, { padding: [36, 36], maxZoom: 15 });
  }, [map, visible, hot, center, single]);

  // Fit once per data set (when it first arrives or changes), not on every filter toggle.
  const sig = `${points.length}:${points[0]?.lat},${points[0]?.lng}:${points.at(-1)?.lat}`;
  const fitted = useRef('');
  useEffect(() => {
    if (!map || !points.length || fitted.current === sig) return;
    fitted.current = sig;
    fit();
  }, [map, sig, points.length, fit]);

  const c = center || (points[0] ? [points[0].lat, points[0].lng] : DEFAULT_CENTER);
  const toggle = (k) => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const cats = CATEGORIES.filter((k) => counts[k.value]);

  return (
    <div>
      <MapFrame center={c} zoom={single ? 16 : 12} height={height} cooperative label="Map of reported issues" onMap={setMap}
        controls={!single && (
          <button type="button" className={ctrl} onClick={fit} aria-label="Fit all reports in view" title="Fit all reports"><Focus className="h-4 w-4" aria-hidden /></button>
        )}
        overlay={!single && (
          <div role="radiogroup" aria-label="Display" className="pointer-events-auto flex rounded-lg border border-slate-200 bg-white/95 p-0.5 text-xs font-medium shadow-[0_2px_8px_-2px_rgb(15_23_42/0.25)] dark:border-ink-700 dark:bg-ink-900/95">
            {MODES.map(([k, l, Icon]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => pickMode(k)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${mode === k ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden />{l}
              </button>
            ))}
          </div>
        )}>
        {single
          ? points.map((p, i) => <Marker key={i} position={[p.lat, p.lng]} icon={dropPin} title={categoryLabel(p.category)} />)
          : <DataLayer points={visible} mode={mode} onPointClick={onPointClick} />}
        {/* recurrence hotspots: ring size grows with the number of repeat reports */}
        {hot.map((h) => (
          <CircleMarker key={`h${h.lat},${h.lng},${h.category}`} center={[h.lat, h.lng]} radius={12 + Math.min(20, h.count * 2)} className="nv-hotspot"
            pathOptions={{ color: '#dc2626', weight: 2, fillColor: '#ef4444', fillOpacity: 0.12, dashArray: '5 5' }}>
            <Tooltip>Hotspot: {h.count} × {categoryLabel(h.category)}{h.open != null ? ` · ${h.open} open` : ''}</Tooltip>
          </CircleMarker>
        ))}
      </MapFrame>

      {legend && !single && cats.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by category">
          {cats.map(({ value, label }) => {
            const on = !hidden.has(value);
            return (
              <button key={value} type="button" aria-pressed={on} onClick={() => toggle(value)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${on ? 'border-slate-200 bg-white text-slate-700 dark:border-ink-700 dark:bg-ink-900 dark:text-slate-200' : 'border-dashed border-slate-300 text-slate-400 line-through dark:border-ink-700 dark:text-slate-500'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? CAT_COLOR[value] : '#94a3b8' }} aria-hidden />
                {label}<span className="tabular-nums text-slate-400">{counts[value]}</span>
              </button>
            );
          })}
          {hotspots.length > 0 && (
            <button type="button" aria-pressed={showHot} onClick={() => setShowHot((s) => !s)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${showHot ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300' : 'border-dashed border-slate-300 text-slate-400 line-through dark:border-ink-700'}`}>
              <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-red-500" aria-hidden />Hotspots<span className="tabular-nums opacity-70">{hotspots.length}</span>
            </button>
          )}
          {hidden.size > 0 && <button type="button" onClick={() => setHidden(new Set())} className="px-1.5 text-xs font-medium text-brand-700 hover:underline dark:text-brand-500">Show all</button>}
        </div>
      )}
    </div>
  );
}
