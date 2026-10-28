import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Empty, ErrorBox, PageTitle, Spinner } from '../components/ui';
import { api } from '../services/api';
import { fmtDate } from '../utils/format';

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api('/notifications').then(({ data }) => setItems(data)).catch(setError);
  useEffect(() => { load(); }, []);

  const read = (n) => !n.readAt && api(`/notifications/${n._id}/read`, { method: 'PATCH' }).catch(() => {});

  return (
    <>
      <PageTitle
        title="Notifications"
        actions={items?.some((n) => !n.readAt) && <button type="button" className="btn-secondary" onClick={() => api('/notifications/read-all', { method: 'POST' }).then(load)}>Mark all read</button>}
      />
      <ErrorBox error={error} />
      {!items && !error && <Spinner />}
      {items?.length === 0 && <Empty title="You're all caught up" />}
      {items?.length > 0 && (
        <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((n) => (
            <li key={n._id}>
              <Link to={n.complaintId ? `/complaints/${n.complaintId}` : '#'} onClick={() => read(n)} className="flex gap-3 p-4 hover:bg-slate-50 dark:hover:bg-ink-800">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-brand-600'}`} aria-label={n.readAt ? undefined : 'Unread'} />
                <div>
                  <p className={n.readAt ? '' : 'font-semibold'}>{n.title}</p>
                  {n.message && <p className="text-sm text-slate-600 dark:text-slate-400">{n.message}</p>}
                  <p className="mt-1 text-xs text-slate-500">{fmtDate(n.createdAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
