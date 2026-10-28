import Cache from '../models/Cache.js';
import { badRequest } from '../utils/http.js';

// Free, keyless public services. Calls go through the API so we can cache results (shared across
// serverless instances) and send the identifying User-Agent that Nominatim's usage policy requires.
const UA = 'NagriVanta/1.0 (civic issue reporting pilot; https://github.com/NAMAN-VERMA-02/NagriVanta)';
const DAY = 864e5;

async function cached(key, ttlMs, fetcher) {
  const hit = await Cache.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
  if (hit) return hit.data;
  const data = await fetcher();
  await Cache.updateOne({ key }, { data, expiresAt: new Date(Date.now() + ttlMs) }, { upsert: true });
  return data;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

export const isPincode = (p) => /^[1-9]\d{5}$/.test(String(p || ''));

/** India Post pincode details (post offices, district, state) plus an approximate map centre. */
export async function lookupPincode(pin) {
  if (!isPincode(pin)) throw badRequest('Enter a valid 6-digit Indian pincode');
  return cached(`pin:${pin}`, 30 * DAY, async () => {
    const [post, geo] = await Promise.allSettled([
      getJson(`https://api.postalpincode.in/pincode/${pin}`),
      getJson(`https://nominatim.openstreetmap.org/search?postalcode=${pin}&country=India&format=json&limit=1`),
    ]);
    const offices = post.status === 'fulfilled' && post.value?.[0]?.Status === 'Success' ? post.value[0].PostOffice || [] : [];
    const g = geo.status === 'fulfilled' ? geo.value?.[0] : null;
    if (!offices.length && !g) throw badRequest('Pincode not found');
    return {
      pincode: pin,
      district: offices[0]?.District || null,
      state: offices[0]?.State || null,
      areas: offices.map((o) => ({ name: o.Name, block: o.Block, type: o.BranchType })).slice(0, 25),
      center: g ? { lat: Number(g.lat), lng: Number(g.lon) } : null,
    };
  });
}

/** Address + pincode for a map point (reverse geocoding), rounded so nearby clicks share a cache entry. */
export async function reverseGeocode(lat, lng) {
  const rl = Math.round(lat * 2000) / 2000;
  const rg = Math.round(lng * 2000) / 2000;
  return cached(`rev:${rl},${rg}`, 30 * DAY, async () => {
    const j = await getJson(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`);
    const a = j.address || {};
    return {
      label: [a.road || a.pedestrian, a.neighbourhood || a.suburb || a.quarter, a.city || a.town || a.village].filter(Boolean).join(', ') || j.display_name,
      pincode: isPincode(a.postcode) ? a.postcode : null,
      area: a.suburb || a.neighbourhood || a.quarter || null,
      city: a.city || a.town || a.state_district || null,
    };
  });
}

/** Place search for the map search box (India only). */
export async function searchPlaces(q) {
  const query = String(q || '').trim().slice(0, 120);
  if (query.length < 3) return [];
  return cached(`search:${query.toLowerCase()}`, 7 * DAY, async () => {
    const rows = await getJson(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=6&addressdetails=0`);
    return rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
  });
}
