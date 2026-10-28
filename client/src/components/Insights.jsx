import { useEffect, useState } from 'react';
import { CloudRain, Repeat, TriangleAlert } from 'lucide-react';
import { api } from '../services/api';
import { categoryLabel, fmtDay } from '../utils/format';

const LEVEL = {
  high: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
  medium: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
};
const ICON = { waterlogging: CloudRain, potholes: TriangleAlert, recurring: Repeat };

// Predictive risk alerts (rain forecast × ward history), shared by Home, Scorecard and Analytics.
export function RiskAlerts({ city, limit = 6, title = 'Risk alerts for the next 3 days' }) {
  const [data, setData] = useState(null);
  useEffect(() => { api('/public/risk-alerts', { query: { city } }).then(({ data: d }) => setData(d)).catch(() => setData({ alerts: [] })); }, [city]);
  if (!data) return null;
  return (
    <section className="card p-5" aria-labelledby="risk-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="risk-title" className="font-semibold">{title}</h2>
        <p className="text-xs text-slate-500">{data.weatherAvailable ? 'Open-Meteo forecast + 180-day complaint history' : 'Weather unavailable: history-based alerts only'}</p>
      </div>
      {data.alerts.length === 0 ? <p className="mt-3 text-sm text-slate-500">No elevated risk right now.</p> : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.alerts.slice(0, limit).map((a, i) => {
            const Icon = ICON[a.type] || TriangleAlert;
            return (
              <li key={i} className={`flex gap-3 rounded-xl border p-3 text-sm ${LEVEL[a.level] || LEVEL.medium}`}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold capitalize">{a.ward}, {a.city} · {a.type} · {a.level}</p>
                  <p className="text-xs opacity-90">{a.reason}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">{data.method}. Use as an inspection prompt, not a forecast guarantee.</p>
    </section>
  );
}

export function HotspotTable({ hotspots = [] }) {
  if (!hotspots.length) return <p className="text-sm text-slate-500">No location has 3+ reports of the same kind in the last 90 days.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Place</th><th>Issue</th><th className="text-right">Reports</th><th className="text-right">Still open</th><th className="text-right">Last</th></tr></thead>
        <tbody>
          {hotspots.slice(0, 10).map((h) => (
            <tr key={`${h.lat},${h.lng},${h.category}`} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-2">{h.ward || '—'}, {h.city} <span className="text-xs text-slate-400">({h.lat}, {h.lng})</span></td>
              <td>{categoryLabel(h.category)}</td>
              <td className="text-right font-semibold tabular-nums">{h.count}</td>
              <td className="text-right tabular-nums">{h.open}</td>
              <td className="text-right text-xs">{fmtDay(h.lastReportedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CityFilter({ value, onChange }) {
  const [cities, setCities] = useState([]);
  useEffect(() => { api('/cities').then(({ data }) => setCities(data)).catch(() => {}); }, []);
  return (
    <div>
      <label className="label" htmlFor="cityf">City</label>
      <select id="cityf" className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All cities</option>
        {cities.map((c) => <option key={c.name}>{c.name}</option>)}
      </select>
    </div>
  );
}
