import { useEffect, useState } from 'react';
import { LocateFixed, ThumbsUp } from 'lucide-react';
import { CategoryBadge, Empty, ErrorBox, PageTitle, Spinner, StatusBadge } from '../components/ui';
import { usePrefs } from '../context/PrefsContext';
import { api, imageUrl } from '../services/api';
import { fmtDay } from '../utils/format';

// Community feed: issues near the citizen, with one "me too" vote each (raises priority).
export default function Community() {
  const { t, lite } = usePrefs();
  const [near, setNear] = useState('');
  const [sort, setSort] = useState('top');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setItems(null);
    api('/complaints', { query: { near, sort, limit: 30 } }).then(({ data }) => setItems(data)).catch(setError);
  }, [near, sort]);

  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => setNear(`${p.coords.latitude.toFixed(4)},${p.coords.longitude.toFixed(4)}`),
    () => setError({ message: 'Location permission denied; showing all issues.' }),
  );

  const vote = async (c) => {
    const method = c.hasVoted ? 'DELETE' : 'POST';
    setItems((list) => list.map((x) => (x.id === c.id ? { ...x, hasVoted: !c.hasVoted, upvotes: x.upvotes + (c.hasVoted ? -1 : 1) } : x)));
    try {
      const { data } = await api(`/complaints/${c.id}/upvote`, { method });
      setItems((list) => list.map((x) => (x.id === c.id ? { ...x, upvotes: data.upvotes, hasVoted: data.hasVoted } : x)));
    } catch (err) {
      setError(err);
      setItems((list) => list.map((x) => (x.id === c.id ? c : x)));
    }
  };

  return (
    <>
      <PageTitle
        title={t('community.title')}
        subtitle={t('community.sub')}
        actions={(
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={locate}><LocateFixed className="h-4 w-4" aria-hidden /> {t('community.locate')}</button>
            <div className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700" role="group" aria-label="Sort">
              {['top', 'new'].map((s) => (
                <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${sort === s ? 'bg-brand-700 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{t(`community.${s}`)}</button>
              ))}
            </div>
          </div>
        )}
      />
      <ErrorBox error={error} />
      {!items && !error && <Spinner />}
      {items?.length === 0 && <Empty title="No issues here yet" />}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((c) => (
          <li key={c.id} className="card flex flex-col overflow-hidden">
            {c.image && !lite && <img src={imageUrl(c.image)} alt="" loading="lazy" className="h-40 w-full object-cover" />}
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex flex-wrap gap-2"><StatusBadge status={c.status} /><CategoryBadge category={c.category} /></div>
              <p className="font-semibold">{c.title}</p>
              <p className="text-xs text-slate-500">{c.referenceId} · {c.ward || c.city} · {fmtDay(c.createdAt)}</p>
              <div className="mt-auto pt-2">
                {c.isMine ? <p className="text-xs text-slate-500">Your report · {c.upvotes} supporters</p> : (
                  <button type="button" onClick={() => vote(c)} aria-pressed={c.hasVoted}
                    className={`btn w-full ${c.hasVoted ? 'bg-brand-700 text-white hover:bg-brand-800' : 'btn-secondary'}`}>
                    <ThumbsUp className="h-4 w-4" aria-hidden /> {t('community.metoo')} · {c.upvotes}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
