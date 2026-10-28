import { useEffect, useState } from 'react';
import { HBar, TrendLine } from '../components/Charts';
import { CityFilter, HotspotTable, RiskAlerts } from '../components/Insights';
import { MapLegend, PointsMap } from '../components/Maps';
import { ErrorBox, PageTitle, Spinner, Stat } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { STATUS, categoryLabel } from '../utils/format';

const toBars = (obj, label = (k) => k) => Object.entries(obj || {}).map(([k, v]) => ({ name: label(k), value: v })).sort((a, b) => b.value - a.value);

export default function Analytics() {
  const { user } = useAuth();
  const [range, setRange] = useState({ from: '', to: '', city: '' });
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setM(null);
    api('/admin/analytics', { query: range }).then(({ data }) => setM(data)).catch(setError);
  }, [range]);

  return (
    <>
      <PageTitle
        title="Operations analytics"
        subtitle="Computed on the server from case records. Definitions below each metric."
        actions={(
          <div className="flex flex-wrap items-end gap-2">
            {user.role === 'admin' && <CityFilter value={range.city} onChange={(city) => setRange({ ...range, city })} />}
            <div><label className="label" htmlFor="from">From</label><input id="from" type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
            <div><label className="label" htmlFor="to">To</label><input id="to" type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
            {(range.from || range.to || range.city) && <button type="button" className="btn-ghost" onClick={() => setRange({ from: '', to: '', city: '' })}>Clear</button>}
          </div>
        )}
      />
      <ErrorBox error={error} />
      {!m && !error && <Spinner />}
      {m && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Total cases" value={m.total} />
            <Stat label="Overdue" value={m.overdue} tone={m.overdue ? 'text-red-600' : ''} hint={m.definitions.overdue} />
            <Stat label="Median resolution" value={m.medianResolutionHours != null ? `${m.medianResolutionHours} h` : '—'} hint="Resolved cases only" />
            <Stat label="Reopen rate" value={`${m.reopenRate}%`} hint={m.definitions.reopenRate} />
            <Stat label="Auto-routed" value={m.autoRouted} hint="Assigned by smart routing" />
            <Stat label="Citizen rating" value={m.avgRating ? `${m.avgRating} / 5` : '—'} hint={`${m.ratingsCount} ratings`} />
          </div>

          <RiskAlerts city={range.city} title="Predictive risk alerts (next 3 days)" />

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5"><h2 className="mb-3 font-semibold">Cases by status</h2><HBar data={toBars(m.byStatus, (k) => STATUS[k]?.label || k)} label="Cases" /></section>
            <section className="card p-5"><h2 className="mb-3 font-semibold">Cases by category</h2><HBar data={toBars(m.byCategory, categoryLabel)} label="Cases" /></section>
            <section className="card p-5"><h2 className="mb-3 font-semibold">New reports, last 30 days</h2><TrendLine data={m.daily} /></section>
            <section className="card p-5"><h2 className="mb-3 font-semibold">Top wards by volume</h2><HBar data={m.byWard.map((w) => ({ name: w.ward, value: w.count }))} label="Cases" /></section>
            <section className="card p-5"><h2 className="mb-3 font-semibold">Intake channels</h2><HBar data={toBars(m.bySource)} label="Reports" height={200} /></section>
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Officer workload (active cases)</h2>
              {m.workload.length === 0 ? <p className="text-sm text-slate-500">No active assignments.</p> : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Officer</th><th className="text-right">Active</th><th className="text-right">Overdue</th></tr></thead>
                  <tbody>{m.workload.slice(0, 10).map((w) => <tr key={w.officer} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5">{w.officer}</td><td className="text-right tabular-nums">{w.active}</td><td className={`text-right tabular-nums ${w.overdue ? 'font-semibold text-red-600' : ''}`}>{w.overdue}</td></tr>)}</tbody>
                </table>
              )}
              <p className="mt-2 text-xs text-slate-500">Smart routing assigns new cases to the least-loaded officer in the right department.</p>
            </section>
          </div>

          <section className="card p-5">
            <h2 className="mb-1 font-semibold">Recurrence heatmap</h2>
            <p className="mb-3 text-xs text-slate-500">Dots are reports; dashed red rings are hotspots with 3+ reports of the same issue within ~110 m in 90 days.</p>
            <PointsMap points={m.points} hotspots={m.hotspots} height={420} />
            <MapLegend />
            <div className="mt-4"><HotspotTable hotspots={m.hotspots} /></div>
          </section>

          <section className="card p-5">
            <h2 className="mb-2 font-semibold">AI & evidence health</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Triage: {Object.entries(m.aiStatus).map(([k, v]) => `${k} ${v}`).join(' · ')}. Evidence checks: {Object.entries(m.verification).map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(' · ') || 'none yet'}.
              "fallback" means the offline model answered (no Gemini billing/key). Measure accuracy with <code>npm run eval</code> before quoting any number.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
