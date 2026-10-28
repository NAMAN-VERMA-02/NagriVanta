import { useEffect, useState } from 'react';
import { Download, Plug } from 'lucide-react';
import { HBar } from '../components/Charts';
import { CityFilter, HotspotTable, RiskAlerts } from '../components/Insights';
import { PointsMap } from '../components/Maps';
import { ErrorBox, PageTitle, Spinner } from '../components/ui';
import { API_ORIGIN, api } from '../services/api';
import { categoryLabel, fmtDate } from '../utils/format';

export default function Scorecard() {
  const [city, setCity] = useState('');
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { setD(null); api('/public/scorecard', { query: { city } }).then(({ data }) => setD(data)).catch(setError); }, [city]);
  const q = city ? `?city=${encodeURIComponent(city)}` : '';

  return (
    <>
      <PageTitle
        title="Public transparency dashboard"
        subtitle="Aggregate, privacy-safe numbers anyone can check. No personal details are published."
        actions={(
          <div className="flex flex-wrap items-end gap-2">
            <CityFilter value={city} onChange={setCity} />
            <a className="btn-secondary" href={`${API_ORIGIN}/api/v1/public/open-data.csv${q}`}><Download className="h-4 w-4" aria-hidden /> CSV</a>
            <a className="btn-secondary" href={`${API_ORIGIN}/api/v1/public/open-data.json${q}`} target="_blank" rel="noreferrer"><Download className="h-4 w-4" aria-hidden /> JSON</a>
          </div>
        )}
      />
      <ErrorBox error={error} />
      {!d && !error && <Spinner />}
      {d && (
        <div className="space-y-6">
          <section className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="px-4 pt-4 text-left text-xs text-slate-500">
                Wards with fewer than {d.minGroupSize} reports are hidden to protect privacy. Generated {fmtDate(d.generatedAt)}.
              </caption>
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                <tr><th className="px-4 py-3">Ward</th><th className="px-4 py-3 text-right">Reports</th><th className="px-4 py-3 text-right">Resolved</th><th className="px-4 py-3 text-right">Overdue</th><th className="px-4 py-3 text-right">Median fix time</th></tr>
              </thead>
              <tbody>
                {d.wards.map((w) => (
                  <tr key={w.ward} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <th scope="row" className="px-4 py-3 font-medium">{w.ward}</th>
                    {w.suppressed ? <td colSpan={4} className="px-4 py-3 text-right text-slate-400">Too few reports to publish</td> : (
                      <>
                        <td className="px-4 py-3 text-right tabular-nums">{w.total}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className="inline-flex items-center gap-2">
                            <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 sm:inline-block dark:bg-slate-700"><span className="block h-full bg-emerald-500" style={{ width: `${w.resolvedPct}%` }} /></span>
                            {w.resolvedPct}%
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums ${w.overduePct > 20 ? 'font-semibold text-red-600' : ''}`}>{w.overduePct}%</td>
                        <td className="px-4 py-3 text-right tabular-nums">{w.medianResolutionHours != null ? `${w.medianResolutionHours} h` : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <RiskAlerts city={city} />

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Reports by category</h2>
              <HBar data={Object.entries(d.byCategory).map(([k, v]) => ({ name: categoryLabel(k), value: v })).sort((a, b) => b.value - a.value)} label="Reports" />
            </section>
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Where issues recur</h2>
              <PointsMap points={d.points} hotspots={d.hotspots} height={280} />
            </section>
          </div>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Recurring hotspots (90 days)</h2>
            <HotspotTable hotspots={d.hotspots} />
          </section>
          <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <Plug className="h-8 w-8 shrink-0 text-brand-700 dark:text-brand-500" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">Integration for other government systems</p>
              <p className="text-slate-600 dark:text-slate-400">
                Standard <a className="underline" href={`${API_ORIGIN}/open311/v2/services.json`} target="_blank" rel="noreferrer">Open311 GeoReport v2 API</a> to read and file cases with one shared case ID,
                signed webhooks for status changes, and open data under CC BY 4.0.
              </p>
            </div>
          </section>
          <p className="text-xs text-slate-500">Resolved = resolved or closed. Overdue = still open after its SLA due date. Median fix time = submission to resolution. Demo data is synthetic.</p>
        </div>
      )}
    </>
  );
}
