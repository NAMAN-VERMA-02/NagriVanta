import Cache from '../models/Cache.js';
import Complaint from '../models/Complaint.js';
import { CITIES } from '../config/constants.js';
import { env } from '../config/env.js';

const WEATHER_TTL_MS = 3 * 36e5;

/**
 * 3-day rain forecast per ward from Open-Meteo (free, no API key), cached in MongoDB so all
 * serverless instances share one call. Returns null when the forecast cannot be fetched.
 */
export async function wardForecasts() {
  if (!env.weatherEnabled) return null;
  const cached = await Cache.findOne({ key: 'weather:wards', expiresAt: { $gt: new Date() } });
  if (cached) return cached.data;
  const wards = Object.entries(CITIES).flatMap(([city, c]) => Object.entries(c.wards).map(([ward, p]) => ({ city, ward, ...p })));
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${wards.map((w) => w.lat).join(',')}&longitude=${wards.map((w) => w.lng).join(',')}`
      + '&daily=precipitation_sum,precipitation_probability_max&forecast_days=3&timezone=Asia%2FKolkata';
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const json = await res.json();
    const list = Array.isArray(json) ? json : [json];
    const data = Object.fromEntries(wards.map((w, i) => [w.ward, {
      rainMm: Math.max(0, ...(list[i]?.daily?.precipitation_sum || [0])),
      rainChance: Math.max(0, ...(list[i]?.daily?.precipitation_probability_max || [0])),
    }]));
    await Cache.updateOne({ key: 'weather:wards' }, { data, expiresAt: new Date(Date.now() + WEATHER_TTL_MS) }, { upsert: true });
    return data;
  } catch (err) {
    console.error('weather fetch failed:', err.message);
    return null;
  }
}

// Pure scoring so it can be tested without network or DB.
export function scoreWardRisk({ rainMm = 0, rainChance = 0, drainage = 0, water = 0, road = 0 }) {
  const alerts = [];
  const heavyRain = rainMm >= 20 || (rainMm >= 10 && rainChance >= 70);
  if (heavyRain && drainage >= 2) alerts.push({ type: 'waterlogging', level: 'high', reason: `${rainMm} mm rain expected and ${drainage} drainage reports in 180 days` });
  else if (rainMm >= 5 && drainage >= 1) alerts.push({ type: 'waterlogging', level: 'medium', reason: `${rainMm} mm rain expected and earlier drainage complaints` });
  if (heavyRain && road >= 2) alerts.push({ type: 'potholes', level: 'medium', reason: `Heavy rain on a stretch with ${road} road complaints; potholes tend to widen` });
  if (drainage + water >= 4) alerts.push({ type: 'recurring', level: 'medium', reason: `${drainage + water} water/drainage complaints in 180 days: schedule a preventive inspection` });
  if (road >= 4) alerts.push({ type: 'recurring', level: 'medium', reason: `${road} road complaints in 180 days: plan resurfacing instead of patching` });
  return alerts;
}

/**
 * Predictive risk alerts: combines the rain forecast with each ward's complaint history.
 * Transparent rules, compared against the simple baseline "history only" when weather is down.
 */
export async function riskAlerts({ city } = {}) {
  const since = new Date(Date.now() - 180 * 864e5);
  const rows = await Complaint.aggregate([
    { $match: { createdAt: { $gte: since }, category: { $in: ['drainage', 'water', 'road'] }, ...(city && { city }) } },
    { $group: { _id: { ward: '$ward', category: '$category' }, n: { $sum: 1 } } },
  ]);
  const history = {};
  for (const r of rows) {
    if (!r._id.ward) continue;
    history[r._id.ward] ??= { drainage: 0, water: 0, road: 0 };
    history[r._id.ward][r._id.category] = r.n;
  }
  const weather = await wardForecasts();
  const alerts = [];
  for (const [cityName, c] of Object.entries(CITIES)) {
    if (city && city !== cityName) continue;
    for (const ward of Object.keys(c.wards)) {
      const w = weather?.[ward] || {};
      for (const a of scoreWardRisk({ ...w, ...(history[ward] || {}) })) alerts.push({ city: cityName, ward, ...a, rainMm: w.rainMm ?? null });
    }
  }
  const order = { high: 0, medium: 1, low: 2 };
  return {
    alerts: alerts.sort((a, b) => order[a.level] - order[b.level]),
    weatherAvailable: Boolean(weather),
    method: 'Rule-based: 3-day Open-Meteo rain forecast × 180-day complaint history per ward',
    generatedAt: new Date(),
  };
}
