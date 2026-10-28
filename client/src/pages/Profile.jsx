import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  Activity, Award, Camera, CircleCheck, Compass, Flag, KeyRound, Lock, Mail, MapPinned, Phone, Repeat, Settings, ShieldCheck, Star, ThumbsUp,
} from 'lucide-react';
import { PointsMap } from '../components/Maps';
import { Avatar, CategoryBadge, Empty, ErrorBox, Skeleton, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { useTheme } from '../context/ThemeContext';
import { useCountUp } from '../hooks/useMotion';
import { api } from '../services/api';
import { ACTION_LABEL, STATUS, categoryLabel, fmtDate, fmtDay } from '../utils/format';

const BADGE_ICON = { first: Flag, photo: Camera, fixed: CircleCheck, voice: ThumbsUp, rater: Star, explorer: Compass, trusted: ShieldCheck, regular: Repeat };
const TABS = [['overview', 'Overview', Award], ['activity', 'Activity', Activity], ['map', 'My map', MapPinned], ['settings', 'Settings', Settings]];

function StatStrip({ items }) {
  return (
    <dl className="grid grid-cols-2 divide-slate-100 rounded-2xl border border-slate-200 bg-white sm:grid-cols-3 lg:grid-cols-5 lg:divide-x dark:divide-ink-700 dark:border-slate-800 dark:bg-ink-900">
      {items.map(([label, value, hint]) => (
        <div key={label} className="p-4 sm:p-5">
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value ?? '—'}</dd>
          {hint && <dd className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

function MonthBars({ data, label }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure>
      <div className="flex h-36 items-end gap-3" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
        {data.map((d, i) => (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">{d.count || ''}</span>
            <div className="w-full max-w-10 origin-bottom animate-[rise_0.8s_var(--ease-out-expo)_both] rounded-t-md bg-brand-600 dark:bg-brand-500"
              style={{ height: `${Math.max(4, (d.count / max) * 96)}px`, animationDelay: `${i * 60}ms`, opacity: d.count ? 1 : 0.25 }} />
            <span className="text-xs text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

function LevelCard({ level }) {
  const pts = useCountUp(level.points);
  return (
    <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-5 text-white backdrop-blur-sm sm:w-80">
      <p className="text-sm text-brand-100">Civic level</p>
      <p className="mt-0.5 text-xl font-bold">{level.name}</p>
      <p className="mt-3 flex items-baseline gap-1.5"><span className="text-3xl font-extrabold tabular-nums">{pts}</span><span className="text-sm text-brand-100">points</span></p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)} aria-label="Progress to next level">
        <div className="h-full origin-left animate-[draw_1.2s_var(--ease-out-expo)_both] rounded-full bg-white" style={{ width: `${Math.round(level.progress * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-brand-100">{level.nextName ? `${level.nextAt - level.points} points to ${level.nextName}` : 'Highest level reached'}</p>
    </div>
  );
}

function Overview({ p, isCitizen }) {
  const s = p.stats;
  const cats = Object.entries(p.byCategory || {}).sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(1, ...cats.map(([, n]) => n));
  return (
    <div className="space-y-6">
      {isCitizen ? (
        <StatStrip items={[
          ['Reports filed', s.reports, `${s.open} still open`],
          ['Resolved', `${s.resolutionRate}%`, `${s.resolved} of ${s.reports}`],
          ['Median fix time', s.medianResolutionHours != null ? `${s.medianResolutionHours} h` : null, 'for your resolved reports'],
          ['Support received', s.supportReceived, '"me too" on your reports'],
          ['You supported', s.votesGiven, `${s.ratingsGiven} fixes rated`],
        ]} />
      ) : (
        <StatStrip items={[
          ['Active cases', s.active, p.user.role === 'admin' ? 'across the platform' : 'assigned to you'],
          ['Overdue', s.overdue, 'past their SLA date'],
          ['Resolved by you', s.resolvedByMe, `${s.statusUpdates} status updates`],
          ['Median fix time', s.medianResolutionHours != null ? `${s.medianResolutionHours} h` : null, 'report to resolution'],
          ['Citizen rating', s.avgCitizenRating ? `${s.avgCitizenRating} / 5` : null, `${s.ratings} ratings`],
        ]} />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-3">
          <h2 className="font-semibold">{isCitizen ? 'Reports in the last 6 months' : 'Cases you resolved, last 6 months'}</h2>
          <div className="mt-4"><MonthBars data={p.monthly} label={isCitizen ? 'Reports per month' : 'Resolved per month'} /></div>
        </section>
        <section className="card p-5 lg:col-span-2">
          {isCitizen ? (
            <>
              <h2 className="font-semibold">What you report</h2>
              {cats.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nothing yet.</p> : (
                <ul className="mt-4 space-y-3">
                  {cats.map(([c, n]) => (
                    <li key={c}>
                      <div className="flex justify-between text-sm"><span>{categoryLabel(c)}</span><span className="tabular-nums text-slate-500">{n}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-ink-800"><div className="h-full animate-[draw_1s_var(--ease-out-expo)_both] rounded-full bg-brand-600" style={{ width: `${(n / catMax) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <h2 className="font-semibold">Your actions</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {[['Assignments made', s.assignmentsMade], ['Triage reviews', s.reviews], ['Status updates', s.statusUpdates], ['Notes added', s.notes]].map(([l, n]) => (
                  <li key={l} className="flex justify-between border-b border-slate-100 pb-2 last:border-0 dark:border-ink-700"><span>{l}</span><span className="font-semibold tabular-nums">{n}</span></li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {isCitizen && (
        <section className="card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Badges</h2>
            <p className="text-xs text-slate-500">{p.badges.filter((b) => b.earned).length} of {p.badges.length} earned</p>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {p.badges.map((b) => {
              const Icon = BADGE_ICON[b.id] || Award;
              return (
                <li key={b.id} className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${b.earned ? 'bg-brand-700 text-white shadow-[0_6px_14px_-6px_rgb(15_118_110/0.8)]' : 'bg-slate-100 text-slate-400 dark:bg-ink-800 dark:text-slate-500'}`}>
                    {b.earned ? <Icon className="h-5 w-5" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                  </span>
                  <span className="min-w-0 text-sm leading-tight">
                    <span className={`block font-semibold ${b.earned ? '' : 'text-slate-500 dark:text-slate-400'}`}>{b.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{b.earned ? 'Earned' : b.hint}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-ink-700 dark:text-slate-400">
            How points work: report +{p.pointsRules.report}, with a photo +{p.pointsRules.reportWithPhoto}, resolved +{p.pointsRules.resolved}, "me too" +{p.pointsRules.vote}, rating a fix +{p.pointsRules.feedback}.
          </p>
        </section>
      )}

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">{isCitizen ? 'Recent reports' : 'Open cases'}</h2>
          <Link to={isCitizen ? '/my-reports' : '/queue'} className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-500">View all</Link>
        </div>
        {p.reports.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nothing here yet.</p> : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-ink-700">
            {p.reports.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link to={`/complaints/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 transition hover:text-brand-700 dark:hover:text-brand-500">
                  <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                  <CategoryBadge category={r.category} /><StatusBadge status={r.status} />
                  <span className="w-full text-xs text-slate-500 sm:w-auto">{r.referenceId} · {fmtDay(r.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActivityTab({ activity }) {
  const groups = useMemo(() => {
    const g = new Map();
    for (const a of activity) {
      const day = fmtDay(a.at);
      if (!g.has(day)) g.set(day, []);
      g.get(day).push(a);
    }
    return [...g];
  }, [activity]);
  if (!activity.length) return <Empty title="No activity yet">Your reports, votes and updates will appear here.</Empty>;
  return (
    <div className="card p-5 sm:p-6">
      {groups.map(([day, items]) => (
        <section key={day} className="mb-6 last:mb-0">
          <h3 className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{day}</h3>
          <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-ink-700">
            {items.map((a, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-600 dark:border-ink-900" />
                <p className="text-sm">
                  <span className="font-semibold">{ACTION_LABEL[a.action] || a.action}</span>
                  {a.toStatus && <span className="text-slate-500"> → {STATUS[a.toStatus]?.label}</span>}
                  <span className="text-slate-500"> · </span>
                  <Link to={`/complaints/${a.complaint.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-500">{a.complaint.title}</Link>
                </p>
                <p className="text-xs text-slate-500">{a.complaint.referenceId} · {new Date(a.at).toLocaleTimeString(undefined, { timeStyle: 'short' })}</p>
                {a.note && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function SettingsTab({ p, onSaved }) {
  const { lang, toggleLang, lite, toggleLite } = usePrefs();
  const { theme, toggle } = useTheme();
  const [form, setForm] = useState({ name: p.user.name, phone: p.user.phone || '' });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwErr, setPwErr] = useState(null);

  const save = async (e) => {
    e.preventDefault(); setErr(null); setMsg(null);
    try {
      await api('/profile', { method: 'PATCH', body: { name: form.name, phone: form.phone } });
      setMsg('Saved'); onSaved();
    } catch (x) { setErr(x); }
  };
  const changePw = async (e) => {
    e.preventDefault(); setPwErr(null); setPwMsg(null);
    try {
      await api('/profile/password', { method: 'POST', body: pw });
      setPw({ currentPassword: '', newPassword: '' }); setPwMsg('Password changed');
    } catch (x) { setPwErr(x); }
  };
  const Toggle = ({ on, onClick, label, hint }) => (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p></div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-slate-300 dark:bg-ink-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={save} className="card space-y-4 p-6" noValidate>
        <h2 className="font-semibold">Personal details</h2>
        <ErrorBox error={err} />
        <div><label className="label" htmlFor="pname">Full name</label><input id="pname" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required /></div>
        <div><label className="label" htmlFor="pphone">Phone (optional)</label><input id="pphone" className="input" inputMode="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><span className="label">Email</span><p className="text-sm text-slate-600 dark:text-slate-300">{p.user.email}</p></div>
        <div className="flex items-center gap-3"><button className="btn-primary">Save changes</button>{msg && <span role="status" className="animate-fade text-sm font-medium text-emerald-700 dark:text-emerald-400">{msg}</span>}</div>
      </form>
      <div className="space-y-6">
        <section className="card px-6 py-3">
          <h2 className="pt-3 font-semibold">Preferences</h2>
          <div className="divide-y divide-slate-100 dark:divide-ink-700">
            <Toggle on={lang === 'hi'} onClick={toggleLang} label="Hindi interface" hint="हिंदी में मेनू और संदेश" />
            <Toggle on={theme === 'dark'} onClick={toggle} label="Dark mode" hint="Easier on the eyes at night" />
            <Toggle on={lite} onClick={toggleLite} label="Lite mode" hint="Saves data: no map tiles, smaller photos" />
          </div>
        </section>
        <form onSubmit={changePw} className="card space-y-4 p-6" noValidate>
          <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-brand-700 dark:text-brand-500" aria-hidden /> Change password</h2>
          <ErrorBox error={pwErr} />
          <div><label className="label" htmlFor="cur">Current password</label><input id="cur" type="password" autoComplete="current-password" className="input" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
          <div><label className="label" htmlFor="new">New password</label><input id="new" type="password" autoComplete="new-password" minLength={8} className="input" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /><p className="mt-1 text-xs text-slate-500">At least 8 characters.</p></div>
          <div className="flex items-center gap-3"><button className="btn-secondary" disabled={!pw.currentPassword || pw.newPassword.length < 8}>Update password</button>{pwMsg && <span role="status" className="animate-fade text-sm font-medium text-emerald-700 dark:text-emerald-400">{pwMsg}</span>}</div>
        </form>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'overview';
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api('/profile').then(({ data }) => setP(data)).catch(setError);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox error={error} />;
  const isCitizen = user.role === 'citizen';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-brand-800 text-white shadow-[0_24px_48px_-28px_rgb(15_118_110/0.9)] dark:bg-brand-900">
        {/* a quiet map-grid texture: this is a product about places */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]" aria-hidden>
          <defs><pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="white" strokeWidth="1" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <path d="M-20 160 C 120 60, 260 220, 420 110 S 720 40, 980 150 S 1300 90, 1500 140" fill="none" stroke="white" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
        </svg>
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <span className="rounded-full ring-4 ring-white/25"><Avatar name={p?.user.name || user.name} size="xl" /></span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold sm:text-3xl">{p?.user.name || user.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-100">
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold capitalize text-white">{user.role}</span>
                {user.city && <span>{user.city}</span>}
                <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" aria-hidden />{user.email}</span>
                {p?.user.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" aria-hidden />{p.user.phone}</span>}
              </p>
              {p && <p className="mt-1 text-xs text-brand-100">Member since {fmtDay(p.user.createdAt)}</p>}
            </div>
          </div>
          {p?.level ? <LevelCard level={p.level} /> : (isCitizen && <Skeleton className="h-36 w-80 opacity-40" />)}
        </div>
      </section>

      <div role="tablist" aria-label="Profile sections" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-ink-900">
        {TABS.map(([k, label, Icon]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setParams(k === 'overview' ? {} : { tab: k }, { replace: true })}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-ink-800'}`}>
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {!p ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div></div>
      ) : (
        <div key={tab} className="animate-page" role="tabpanel">
          {tab === 'overview' && <Overview p={p} isCitizen={isCitizen} />}
          {tab === 'activity' && <ActivityTab activity={p.activity} />}
          {tab === 'map' && (
            <section className="card p-4">
              <p className="mb-3 px-1 text-sm text-slate-600 dark:text-slate-300">{isCitizen ? 'Every place you have reported. Click a dot to open the case.' : 'Your open cases. Click a dot to open it.'} Use the layers button to switch to satellite or terrain.</p>
              {p.reports.length ? <PointsMap points={p.reports} height={480} onPointClick={(r) => navigate(`/complaints/${r.id}`)} /> : <Empty title="No places yet" />}
            </section>
          )}
          {tab === 'settings' && <SettingsTab p={p} onSaved={() => { load(); refresh(); }} />}
          <p className="mt-6 text-xs text-slate-500">Last updated {fmtDate(new Date())}</p>
        </div>
      )}
    </div>
  );
}
