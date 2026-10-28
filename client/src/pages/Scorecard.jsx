import { useEffect, useState } from 'react';
import { HBar } from '../components/Charts';
import { MapLegend, PointsMap } from '../components/Maps';
import { ErrorBox, PageTitle, Spinner } from '../components/ui';
import { api } from '../services/api';
import { categoryLabel, fmtDate } from '../utils/format';

export default function Scorecard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api('/public/scorecard').then(({ data }) => setD(data)).catch(setError); }, []);

  return (
    <>
      <PageTitle title="Public ward scorecard" subtitle="Aggregate, privacy-safe numbers anyone can check. No personal details are published." />
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
                        <td className="px-4 py-3 text-right tabular-nums">{w.resolvedPct}%</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${w.overduePct > 20 ? 'font-semibold text-red-600' : ''}`}>{w.overduePct}%</td>
                        <td className="px-4 py-3 text-right tabular-nums">{w.medianResolutionHours != null ? `${w.medianResolutionHours} h` : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Reports by category</h2>
              <HBar data={Object.entries(d.byCategory).map(([k, v]) => ({ name: categoryLabel(k), value: v })).sort((a, b) => b.value - a.value)} label="Reports" />
            </section>
            <section className="card p-5">
              <h2 className="mb-3 font-semibold">Where issues are reported</h2>
              <PointsMap points={d.points} height={280} />
              <MapLegend />
            </section>
          </div>
          <p className="text-xs text-slate-500">Resolved = resolved or closed. Overdue = still open after its SLA due date. Median fix time = submission to resolution. Demo data is synthetic.</p>
        </div>
      )}
    </>
  );
}
