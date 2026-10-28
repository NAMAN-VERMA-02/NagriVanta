import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Clock, Lock, MapPin, Sparkles, Star } from 'lucide-react';
import { PointsMap } from '../components/Maps';
import { CategoryBadge, ErrorBox, PriorityBadge, Spinner, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, imageUrl } from '../services/api';
import { ACTION_LABEL, CATEGORIES, STATUS, categoryLabel, fmtDate, timeLeft } from '../utils/format';

function Section({ title, children, icon: Icon }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">{Icon && <Icon className="h-4 w-4 text-brand-700 dark:text-brand-500" aria-hidden />}{title}</h2>
      {children}
    </section>
  );
}

function useAction(reload) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); await reload(); return true; } catch (e) { setError(e); return false; } finally { setBusy(false); }
  };
  return { busy, error, run };
}

function AiCard({ ai, isStaff }) {
  if (!ai || ai.status === 'pending') return <p className="text-sm text-slate-500">AI triage is running… refresh in a moment.</p>;
  return (
    <div className="space-y-2 text-sm">
      <p className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
        {ai.status === 'done' ? 'AI suggestion' : 'Rule-based suggestion'} · awaiting staff review
      </p>
      {ai.summary && <p className="italic">“{ai.summary}”</p>}
      <dl className="grid grid-cols-2 gap-2">
        <div><dt className="text-xs text-slate-500">Suggested category</dt><dd className="font-medium">{categoryLabel(ai.category)}</dd></div>
        <div><dt className="text-xs text-slate-500">Suggested priority</dt><dd className="font-medium capitalize">{ai.priority}</dd></div>
        <div><dt className="text-xs text-slate-500">Confidence</dt><dd className="font-medium">{ai.confidence != null ? `${Math.round(ai.confidence * 100)}%` : '—'}</dd></div>
        <div><dt className="text-xs text-slate-500">Engine</dt><dd className="font-medium">{ai.model}</dd></div>
      </dl>
      {ai.reasons?.length > 0 && <ul className="list-disc pl-5 text-slate-600 dark:text-slate-400">{ai.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      {isStaff && ai.error && <p className="text-xs text-red-600">AI provider issue: {ai.error} (fell back to rules)</p>}
    </div>
  );
}

function Timeline({ history }) {
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-700">
      {history.map((h) => (
        <li key={h._id} className="relative">
          <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white dark:border-ink-900 ${h.internal ? 'bg-slate-400' : 'bg-brand-600'}`} />
          <p className="text-sm font-medium">
            {ACTION_LABEL[h.action] || h.action}
            {h.toStatus && h.fromStatus && <span className="font-normal text-slate-500"> · {STATUS[h.fromStatus]?.label} → {STATUS[h.toStatus]?.label}</span>}
            {h.internal && <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-500"><Lock className="h-3 w-3" aria-hidden />internal</span>}
          </p>
          <p className="text-xs text-slate-500">{fmtDate(h.createdAt)} · {h.actorId?.name || (h.actorRole === 'system' ? 'System' : h.actorRole)}</p>
          {h.note && <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{h.note}</p>}
          {h.metadata?.department && <p className="mt-1 text-xs text-slate-500">Department: {h.metadata.department}{h.metadata.dueAt ? ` · due ${fmtDate(h.metadata.dueAt)}` : ''}</p>}
          {h.metadata?.rating && <p className="mt-1 text-xs text-slate-500">Rating: {'★'.repeat(h.metadata.rating)}</p>}
          {h.metadata?.evidence?.length > 0 && (
            <div className="mt-2 flex gap-2">{h.metadata.evidence.map((e) => <a key={e} href={imageUrl(e)} target="_blank" rel="noreferrer"><img src={imageUrl(e)} alt="Resolution evidence" className="h-16 w-16 rounded object-cover" /></a>)}</div>
          )}
        </li>
      ))}
    </ol>
  );
}

function StaffPanel({ d, reload, user }) {
  const c = d.complaint;
  const { busy, error, run } = useAction(reload);
  const [depts, setDepts] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [review, setReview] = useState({ category: c.category, priority: c.priority, note: '' });
  const [assign, setAssign] = useState({ departmentId: c.departmentId?._id || '', assignedTo: '', dueAt: '', note: '' });
  const [status, setStatus] = useState({ to: d.allowedTransitions[0] || '', note: '' });
  const [evidence, setEvidence] = useState([]);
  const [note, setNote] = useState({ note: '', internal: false });
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    api('/departments').then(({ data }) => setDepts(data)).catch(() => {});
    if (isAdmin) api('/admin/users', { query: { role: 'officer' } }).then(({ data }) => setOfficers(data)).catch(() => {});
  }, [isAdmin]);

  useEffect(() => { setStatus((s) => ({ ...s, to: d.allowedTransitions[0] || '' })); }, [d.allowedTransitions]);

  const suggestedDept = depts.find((x) => x.categories.includes(c.category));

  return (
    <div className="space-y-4">
      <ErrorBox error={error} />

      {isAdmin && (
        <Section title="Confirm triage">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => api(`/complaints/${c._id}`, { method: 'PATCH', body: { ...review, note: review.note || undefined } })); }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="rcat">Category</label>
                <select id="rcat" className="input" value={review.category} onChange={(e) => setReview({ ...review, category: e.target.value })}>
                  {CATEGORIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="rpri">Priority</label>
                <select id="rpri" className="input" value={review.priority} onChange={(e) => setReview({ ...review, priority: e.target.value })}>
                  {['low', 'medium', 'high', 'critical'].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <input className="input" placeholder="Reason for override (optional)" aria-label="Reason for override" value={review.note} onChange={(e) => setReview({ ...review, note: e.target.value })} />
            <button className="btn-secondary w-full" disabled={busy}>Save review</button>
          </form>
        </Section>
      )}

      {d.canAssign && (
        <Section title="Assign department">
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            run(() => api(`/complaints/${c._id}/assign`, { method: 'PATCH', body: { departmentId: assign.departmentId, assignedTo: assign.assignedTo || undefined, dueAt: assign.dueAt || undefined, note: assign.note || undefined } }));
          }}>
            <div>
              <label className="label" htmlFor="adept">Department {suggestedDept && <span className="font-normal text-slate-500">(suggested: {suggestedDept.name})</span>}</label>
              <select id="adept" className="input" required value={assign.departmentId} onChange={(e) => setAssign({ ...assign, departmentId: e.target.value, assignedTo: '' })}>
                <option value="">Select…</option>
                {depts.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="aoff">Officer (optional)</label>
              <select id="aoff" className="input" value={assign.assignedTo} onChange={(e) => setAssign({ ...assign, assignedTo: e.target.value })}>
                <option value="">Any officer in department</option>
                {officers.filter((o) => !assign.departmentId || String(o.departmentId) === assign.departmentId).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="adue">Due date (blank = department SLA)</label>
              <input id="adue" type="datetime-local" className="input" value={assign.dueAt} onChange={(e) => setAssign({ ...assign, dueAt: e.target.value })} />
            </div>
            <button className="btn-primary w-full" disabled={busy || !assign.departmentId}>Assign</button>
          </form>
        </Section>
      )}

      {d.allowedTransitions.length > 0 && (
        <Section title="Update status">
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.append('to', status.to);
            if (status.note) fd.append('note', status.note);
            evidence.forEach((f) => fd.append('evidence', f));
            if (await run(() => api(`/complaints/${c._id}/status`, { method: 'PATCH', body: fd }))) { setStatus({ to: '', note: '' }); setEvidence([]); }
          }}>
            <label className="label" htmlFor="sto">Move to</label>
            <select id="sto" className="input" value={status.to} onChange={(e) => setStatus({ ...status, to: e.target.value })}>
              {d.allowedTransitions.map((t) => <option key={t} value={t}>{STATUS[t]?.label}</option>)}
            </select>
            <textarea className="input" aria-label="Note" placeholder={status.to === 'resolved' ? 'Resolution note (required)' : 'Note / reason'} value={status.note} onChange={(e) => setStatus({ ...status, note: e.target.value })} />
            {status.to === 'resolved' && (
              <div>
                <label className="label" htmlFor="ev">After-photo evidence (required)</label>
                <input id="ev" type="file" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" onChange={(e) => setEvidence([...e.target.files].slice(0, 3))} />
              </div>
            )}
            <button className="btn-primary w-full" disabled={busy || !status.to}>Update</button>
          </form>
        </Section>
      )}

      <Section title="Add note">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api(`/complaints/${c._id}/notes`, { method: 'POST', body: note }))) setNote({ note: '', internal: false });
        }}>
          <textarea className="input" aria-label="Note" required value={note.note} onChange={(e) => setNote({ ...note, note: e.target.value })} placeholder="Progress update for the citizen, or an internal note" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={note.internal} onChange={(e) => setNote({ ...note, internal: e.target.checked })} /> Internal only (hidden from citizen)</label>
          <button className="btn-secondary w-full" disabled={busy || !note.note}>Add note</button>
        </form>
      </Section>
    </div>
  );
}

function CitizenPanel({ d, reload }) {
  const c = d.complaint;
  const { busy, error, run } = useAction(reload);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  if (!d.canFeedback && !d.canReopen && !d.feedback) return null;
  return (
    <div className="space-y-4">
      <ErrorBox error={error} />
      {d.feedback && (
        <Section title="Your feedback" icon={Star}>
          <p className="text-amber-500">{'★'.repeat(d.feedback.rating)}<span className="text-slate-300">{'★'.repeat(5 - d.feedback.rating)}</span></p>
          {d.feedback.comment && <p className="mt-1 text-sm">{d.feedback.comment}</p>}
        </Section>
      )}
      {d.canFeedback && (
        <Section title="Was it fixed?" icon={Star}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => api(`/complaints/${c._id}/feedback`, { method: 'POST', body: { rating, comment: comment || undefined } })); }}>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star`} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`}>★</button>
              ))}
            </div>
            <textarea className="input" aria-label="Comment" placeholder="Comment (optional)" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="btn-primary w-full" disabled={busy || !rating}>Submit feedback & close</button>
          </form>
        </Section>
      )}
      {d.canReopen && (
        <Section title="Problem still there?">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => api(`/complaints/${c._id}/reopen`, { method: 'POST', body: { reason } })); }}>
            <textarea className="input" aria-label="Reason" required minLength={5} placeholder="What is still wrong?" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn-secondary w-full" disabled={busy || reason.trim().length < 5}>Reopen case</button>
          </form>
        </Section>
      )}
    </div>
  );
}

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api(`/complaints/${id}`).then(({ data }) => setD(data)).catch(setError), [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorBox error={error} />;
  if (!d) return <Spinner />;
  const c = d.complaint;
  const isStaff = user.role !== 'citizen';
  const sla = ['resolved', 'closed', 'rejected'].includes(c.status) ? null : timeLeft(c.sla?.dueAt);
  const [lng, lat] = c.location.coordinates;

  return (
    <div>
      <Link to={isStaff ? '/queue' : '/my-reports'} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" aria-hidden /> Back</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-slate-500">{c.referenceId}</p>
          <h1 className="text-2xl font-bold tracking-tight">{c.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} /><CategoryBadge category={c.category} /><PriorityBadge priority={c.priority} />
            {!c.priorityConfirmed && <span className="text-xs text-slate-500">(priority not yet confirmed)</span>}
          </div>
        </div>
        {sla && (
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${sla.overdue ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' : 'bg-slate-100 dark:bg-ink-800'}`}>
            <Clock className="h-4 w-4" aria-hidden /> {sla.text}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Report">
            <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">{c.description}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Reported</dt><dd>{fmtDate(c.createdAt)}{c.reportedBy?.name ? ` by ${c.reportedBy.name}` : ''}</dd></div>
              <div><dt className="text-xs text-slate-500">Ward</dt><dd>{c.ward || '—'}</dd></div>
              {c.address && <div><dt className="text-xs text-slate-500">Landmark</dt><dd>{c.address}</dd></div>}
              {c.departmentId?.name && <div><dt className="text-xs text-slate-500">Department</dt><dd>{c.departmentId.name}{c.assignedTo?.name ? ` · ${c.assignedTo.name}` : ''}</dd></div>}
            </dl>
            {c.images?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {c.images.map((src) => <a key={src} href={imageUrl(src)} target="_blank" rel="noreferrer"><img src={imageUrl(src)} alt="Reported issue" className="h-32 w-32 rounded-lg object-cover" /></a>)}
              </div>
            )}
          </Section>

          {c.resolution?.note && (
            <Section title="Resolution">
              <p className="text-sm">{c.resolution.note}</p>
              <p className="mt-1 text-xs text-slate-500">Resolved {fmtDate(c.resolution.resolvedAt)}</p>
              {c.resolution.evidence?.length > 0 && (
                <div className="mt-3 flex gap-3">{c.resolution.evidence.map((e) => <img key={e} src={imageUrl(e)} alt="After-fix evidence" className="h-32 w-32 rounded-lg object-cover" />)}</div>
              )}
            </Section>
          )}

          <Section title="Location" icon={MapPin}>
            <PointsMap points={[{ lat, lng, category: c.category, priority: c.priority }]} center={[lat, lng]} height={260} />
          </Section>

          <Section title="Timeline">
            <Timeline history={d.history} />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Triage suggestion" icon={Sparkles}>
            <AiCard ai={c.aiAnalysis} isStaff={isStaff} />
          </Section>

          {isStaff && c.priorityScore?.factors?.length > 0 && (
            <Section title={`Priority score: ${c.priorityScore.total}`}>
              <ul className="space-y-1 text-sm">
                {c.priorityScore.factors.map((f) => <li key={f.label} className="flex justify-between gap-2"><span>{f.label}</span><span className="font-mono">+{f.points}</span></li>)}
              </ul>
            </Section>
          )}

          {isStaff && c.duplicateCandidates?.length > 0 && (
            <Section title="Possible duplicates">
              <ul className="space-y-2 text-sm">
                {c.duplicateCandidates.map((x) => (
                  <li key={x.referenceId} className="rounded-lg bg-slate-50 p-2 dark:bg-ink-800">
                    <Link to={`/complaints/${x.complaintId}`} className="font-medium text-brand-700 dark:text-brand-500">{x.referenceId}</Link> · score {x.score}
                    <p className="text-xs text-slate-500">{x.title} · {x.signals.join(' · ')}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">Never merged automatically.</p>
            </Section>
          )}

          {isStaff ? <StaffPanel d={d} reload={load} user={user} /> : <CitizenPanel d={d} reload={load} />}
        </div>
      </div>
    </div>
  );
}
