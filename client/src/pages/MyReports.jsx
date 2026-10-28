import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { CategoryBadge, Empty, ErrorBox, PageTitle, Spinner, StatusBadge } from '../components/ui';
import { api, imageUrl } from '../services/api';
import { fmtDay } from '../utils/format';

export default function MyReports() {
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState({ page: 1, total: 0, limit: 20 });
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/complaints/mine', { query: { page } }).then(({ data, meta: m }) => { setItems(data); setMeta(m); }).catch(setError);
  }, [page]);

  return (
    <>
      <PageTitle title="My reports" subtitle="Everything you have reported, newest first." actions={<Link to="/report" className="btn-primary">New report</Link>} />
      <ErrorBox error={error} />
      {!items && !error && <Spinner />}
      {items?.length === 0 && <Empty title="No reports yet">Spotted a pothole or overflowing drain? <Link className="font-semibold text-brand-700" to="/report">Report it</Link>.</Empty>}
      {items?.length > 0 && (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c._id}>
              <Link to={`/complaints/${c._id}`} className="card flex items-center gap-4 p-4 transition hover:border-brand-500">
                {c.images?.[0] && <img src={imageUrl(c.images[0])} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /><CategoryBadge category={c.category} /></div>
                  <p className="mt-1 truncate font-semibold">{c.title}</p>
                  <p className="text-xs text-slate-500">{c.referenceId} · {fmtDay(c.createdAt)}{c.ward ? ` · ${c.ward}` : ''}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {meta.total > meta.limit && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="text-sm">Page {page} of {Math.ceil(meta.total / meta.limit)}</span>
          <button type="button" className="btn-secondary" disabled={page * meta.limit >= meta.total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
