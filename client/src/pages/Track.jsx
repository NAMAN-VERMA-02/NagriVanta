import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Building2, CalendarClock, Check, Copy, Search, ShieldCheck, ThumbsUp } from 'lucide-react';
import { CategoryBadge, ErrorBox, Skeleton, StatusBadge } from '../components/ui';
import { usePrefs } from '../context/PrefsContext';
import { api } from '../services/api';
import { STATUS, fmtDate, fmtDay, timeLeft } from '../utils/format';

const PATH = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed'];

// Public tracking: anyone with a reference ID sees status milestones (no personal data).
export default function Track() {
  const { ref: refParam } = useParams();
  const navigate = useNavigate();
  const { lang } = usePrefs();
  const [input, setInput] = useState(refParam || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!refParam) { setData(null); return; }
    setBusy(true); setError(null);
    api(`/public/track/${encodeURIComponent(refParam)}`).then(({ data: d }) => setData(d)).catch((e) => { setData(null); setError(e); }).finally(() => setBusy(false));
  }, [refParam]);

  const submit = (e) => { e.preventDefault(); const v = input.trim().toUpperCase(); if (v) navigate(`/track/${v}`); };
  const share = async () => { await navigator.clipboard?.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const reached = data ? Math.max(0, PATH.indexOf(['reopened', 'blocked', 'needs_info'].includes(data.status) ? 'under_review' : data.status)) : -1;
  const due = data && !['resolved', 'closed', 'rejected'].includes(data.status) ? timeLeft(data.targetDate) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{lang === 'hi' ? 'शिकायत ट्रैक करें' : 'Track a report'}</h1>
      <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">{lang === 'hi' ? 'रेफ़रेंस आईडी डालें। लॉगिन की ज़रूरत नहीं।' : 'Enter the reference ID you received. No sign-in needed.'}</p>
      <form onSubmit={submit} className="mt-6 flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-500/15 dark:border-slate-700 dark:bg-ink-800">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          <span className="sr-only">Reference ID</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="CIV-261028-1A2B3C4D" autoCapitalize="characters" spellCheck={false}
            className="h-12 w-full bg-transparent font-mono text-sm uppercase tracking-wide outline-none placeholder:normal-case placeholder:tracking-normal" />
        </label>
        <button className="btn-primary px-6" disabled={!input.trim() || busy}>{lang === 'hi' ? 'देखें' : 'Track'}</button>
      </form>

      <div className="mt-8" aria-live="polite">
        <ErrorBox error={error} />
        {busy && <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40 w-full" /></div>}
        {data && !busy && (
          <article className="card animate-pop overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-6 dark:border-ink-700">
              <div>
                <p className="font-mono text-sm text-slate-500">{data.referenceId}</p>
                <div className="mt-2 flex flex-wrap gap-2"><StatusBadge status={data.status} /><CategoryBadge category={data.category} /></div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{[data.ward, data.city].filter(Boolean).join(', ')} · reported {fmtDay(data.reportedAt)}</p>
              </div>
              <button type="button" onClick={share} className="btn-secondary">{copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Link copied' : 'Share link'}</button>
            </div>

            <ol className="grid grid-cols-6 gap-1 px-6 pt-6" aria-label="Progress">
              {PATH.map((s, i) => (
                <li key={s} className="text-center">
                  <span className={`mx-auto block h-1.5 rounded-full transition-colors duration-500 ${i <= reached ? 'bg-brand-600' : 'bg-slate-200 dark:bg-ink-700'}`} style={{ transitionDelay: `${i * 80}ms` }} />
                  <span className={`mt-2 block text-[11px] leading-tight ${i <= reached ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>{STATUS[s].label}</span>
                </li>
              ))}
            </ol>

            <dl className="grid gap-4 p-6 text-sm sm:grid-cols-3">
              <div className="flex gap-2"><Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /><div><dt className="text-xs text-slate-500">Department</dt><dd className="font-medium">{data.department || 'Not assigned yet'}</dd></div></div>
              <div className="flex gap-2"><CalendarClock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /><div><dt className="text-xs text-slate-500">{data.resolvedAt ? 'Resolved' : 'Target date'}</dt><dd className={`font-medium ${due?.overdue ? 'text-red-600' : ''}`}>{data.resolvedAt ? fmtDate(data.resolvedAt) : data.targetDate ? `${fmtDay(data.targetDate)} · ${due?.text}` : 'Set when assigned'}</dd></div></div>
              <div className="flex gap-2"><ThumbsUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden /><div><dt className="text-xs text-slate-500">Supporters</dt><dd className="font-medium tabular-nums">{data.supporters}</dd></div></div>
              {data.evidenceCheck && <div className="flex gap-2 sm:col-span-3"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden /><div><dt className="text-xs text-slate-500">Evidence check</dt><dd className="font-medium capitalize">{data.evidenceCheck.replace('_', ' ')}</dd></div></div>}
            </dl>

            <div className="border-t border-slate-100 p-6 dark:border-ink-700">
              <h2 className="text-sm font-semibold">Timeline</h2>
              <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4 dark:border-ink-700">
                {data.timeline.map((t, i) => (
                  <li key={i} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-600" />
                    <span className="font-medium">{STATUS[t.status]?.label || t.status}</span>
                    <span className="text-slate-500"> · {fmtDate(t.at)}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-slate-500">Only status milestones are public. The person who reported it sees notes and photos after signing in.</p>
            </div>
          </article>
        )}
        {!data && !busy && !error && (
          <p className="text-sm text-slate-500">{lang === 'hi' ? 'आईडी शिकायत भेजने पर मिलता है और ' : 'You get the ID when you submit a report; it is also in '}<Link to="/my-reports" className="font-semibold text-brand-700 hover:underline dark:text-brand-500">{lang === 'hi' ? 'मेरी शिकायतें' : 'My reports'}</Link>.</p>
        )}
      </div>
    </div>
  );
}
