// Leaflet plugins (clustering, heat layer) are classic scripts that extend a global `L`,
// so expose Leaflet globally first, then load them on demand (they are only needed by data maps).
import L from 'leaflet';

let loading;
export function loadLeafletPlugins() {
  loading ??= (async () => {
    window.L = L;
    await import('leaflet.markercluster');
    await import('leaflet.heat');
    return L;
  })();
  return loading;
}
