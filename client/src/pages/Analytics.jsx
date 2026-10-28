import { useEffect, useState } from 'react';
import { HBar, TrendLine } from '../components/Charts';
import { MapLegend, PointsMap } from '../components/Maps';
import { ErrorBox, PageTitle, Spinner, Stat } from '../components/ui';
import { api } from '../services/api';
import { STATUS, categoryLabel } from '../utils/format';

const toBars = (obj, label = (k) => k) => Object.entries(obj || {}).map(([k, v]) => ({ name: label(k), value: v })).sort((a, b) => b.value - a.value);

export default function Analytics() {
  const [range, setRange] = useState({ from: '', to: '' });
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
            <div><label className="label" htmlFor="from">From</label><input id="from" type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
            <div><label className="label" htmlFor="to">To</label><input id="to" type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
            {(range.from || range.to) && <button type="button" className="btn-ghost" onClick={() => setRange({ from: '', to: '' })}>Clear</button>}
          </div>
        )}
      />
      <ErrorBox error={error} />
      {!m && !error && <Spinner />}
      {m && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Stat label="Total cases" value={m.total} />
            <Stat label="Overdue" value={m.overdue} tone={m.overdue ? 'text-red-600' : ''} hint={m.definitions.overdue} />
            <Stat label="Median resolution" value={m.medianResolutionHours != null ? `${m.medianResolutionHours} h` : '—'} hint="Resolved cases only" />
            <Stat label="Reopen rate" value={`${m.reopenRate}%`} hint={m.definitions.reopenRate} />
            <Stat label="Citizen rating" value={m.avgRating ? `${m.avgRating} / 5` : '—'} hint={`${m.ratingsCount} ratings`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5"><h2 className="mb-3 font-semibold">Cases by status</h2><HBar data={toBars(m.byStatus, (k) => STATUS[k]?.label || k)} label="Cases" /></section>
            <section className="card p-5"><h2 className="mb-3 font-semibold">Cases by category</h2><HBar data={toBars(m.byCategory, categoryLabel)} label="Cases" /></section>
            <section className="card p-5"><h2 className="mb-3 font-semibold">New reports, last 30 days</h2><TrendLine data={m.daily} /></section>
            <section className="card p-5"><h2 className="mb-3 font-semibold">Top wards by volume</h2><HBar data={m.byWard.map((w) => ({ name: w.ward, value: w.count }))} label="Cases" /></section>
          </div>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Hotspot map</h2>
            <PointsMap points={m.points} height={420} />
            <MapLegend />
          </section>

          <section className="card p-5">
            <h2 className="mb-2 font-semibold">AI triage health</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {Object.entries(m.aiStatus).map(([k, v]) => `${k}: ${v}`).join(' · ')}. "fallback" means the rule engine answered (no Gemini key or provider error).
              Measure accuracy with <code>npm run eval</code> in the server folder before quoting any number.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
