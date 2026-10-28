import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ThumbsUp } from 'lucide-react';
import { CityFilter } from '../components/Insights';
import { CategoryBadge, Empty, ErrorBox, PageTitle, PriorityBadge, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { CATEGORIES, STATUS, STATUS_KEYS, fmtDay, timeLeft } from '../utils/format';

const FILTERS = ['status', 'category', 'priority', 'city', 'overdue', 'q'];

export default function Queue() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState({ total: 0, limit: 20 });
  const [error, setError] = useState(null);
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    setItems(null);
    const query = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) || '']));
    api('/complaints', { query: { ...query, page } }).then(({ data, meta: m }) => { setItems(data); setMeta(m); }).catch(setError);
  }, [params, page]);

  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    next.delete('page');
    setParams(next);
  };

  return (
    <>
      <PageTitle
        title={user.role === 'admin' ? 'Triage queue' : 'My queue'}
        subtitle={user.role === 'admin' ? 'Review, confirm and assign incoming reports.' : 'Cases assigned to you or your department.'}
      />

      <div className="card mb-4 grid items-center gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
        <input className="input lg:col-span-2" placeholder="Search title or reference" aria-label="Search" defaultValue={params.get('q') || ''}
          onKeyDown={(e) => e.key === 'Enter' && setFilter('q', e.currentTarget.value.trim())} />
        <select className="input" aria-label="Status" value={params.get('status') || ''} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_KEYS.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
        <select className="input" aria-label="Category" value={params.get('category') || ''} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className="input" aria-label="Priority" value={params.get('priority') || ''} onChange={(e) => setFilter('priority', e.target.value)}>
          <option value="">All priorities</option>
          {['critical', 'high', 'medium', 'low'].map((p) => <option key={p}>{p}</option>)}
        </select>
        {user.role === 'admin' && <div className="[&_.label]:sr-only"><CityFilter value={params.get('city') || ''} onChange={(v) => setFilter('city', v)} /></div>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={params.get('overdue') === 'true'} onChange={(e) => setFilter('overdue', e.target.checked ? 'true' : '')} /> Overdue only
        </label>
      </div>

      <ErrorBox error={error} />
      {!items && !error && <Spinner />}
      {items?.length === 0 && <Empty title="Nothing here">No cases match these filters.</Empty>}
      {items?.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Case</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Priority</th><th className="px-4 py-3">Ward</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">SLA</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const sla = ['resolved', 'closed', 'rejected'].includes(c.status) ? null : timeLeft(c.sla?.dueAt);
                return (
                  <tr key={c._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-ink-800">
                    <td className="px-4 py-3">
                      <Link to={`/complaints/${c._id}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-500">{c.title}</Link>
                      <p className="text-xs text-slate-500">{c.referenceId} · {fmtDay(c.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3"><CategoryBadge category={c.category} />{c.aiAnalysis?.category && c.aiAnalysis.category !== c.category && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">AI: {c.aiAnalysis.category}</p>}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                    <td className="px-4 py-3">{c.ward || '—'}<p className="text-xs text-slate-500">{c.city}</p></td>
                    <td className="px-4 py-3">{c.departmentId?.name || <span className="text-slate-400">Unassigned</span>}{c.routing?.method === 'auto' && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-800 dark:bg-brand-800/30 dark:text-brand-100">AUTO</span>}{c.upvotes > 0 && <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500"><ThumbsUp className="h-3 w-3" aria-hidden />{c.upvotes}</p>}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${sla?.overdue ? 'text-red-600' : ''}`}>{sla?.text || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {meta.total > meta.limit && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setFilter('page', String(page - 1))}>Previous</button>
          <span className="text-sm">Page {page} of {Math.ceil(meta.total / meta.limit)} · {meta.total} cases</span>
          <button type="button" className="btn-secondary" disabled={page * meta.limit >= meta.total} onClick={() => { const n = new URLSearchParams(params); n.set('page', String(page + 1)); setParams(n); }}>Next</button>
        </div>
      )}
    </>
  );
}
