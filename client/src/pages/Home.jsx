import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Accessibility, BarChart3, Bell, Bot, Brain, Building2, Camera, ClipboardCheck, CloudRain, Copy, Gauge, Globe2, Languages, Layers,
  Plug, Route, ShieldCheck, Sparkles, Star, Timer, Users, WifiOff,
} from 'lucide-react';
import { RiskAlerts } from '../components/Insights';
import { MapLegend, PointsMap } from '../components/Maps';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { api } from '../services/api';

// The 18 capabilities from the comparison matrix, each mapped to where it lives in the product.
const FEATURES = [
  [Layers, 'Multi-channel intake', 'Web, Android/iOS app, voice dictation, AI chat assistant and the Open311 API all create the same case.'],
  [Camera, 'Photo & video with auto metadata', 'Capture time and GPS are read from the photo; the location can come straight from it.'],
  [Brain, 'AI classification (image + text)', 'Gemini reads text and photo; an offline model trained on 311 data takes over without a key.'],
  [Sparkles, 'AI summary & priority', 'One-line summary plus an explainable priority score with every factor listed.'],
  [Route, 'Smart department routing', 'Auto-assigns to the right city department and the least-loaded officer when confident.'],
  [Copy, 'Duplicate detection', 'Text similarity, distance, category and perceptual photo hashes. Never auto-merged.'],
  [Bell, 'Real-time tracking & alerts', 'Live timeline, in-app and browser notifications on every status change.'],
  [Timer, 'SLA monitoring & escalation', 'Due dates per priority; overdue cases escalate automatically to admins.'],
  [ClipboardCheck, 'Before/after evidence verification', 'Fresh after-photo required; reuse, timing and location checks; tamper-evident hash chain.'],
  [BarChart3, 'Ward analytics & recurrence heatmap', 'Hotspots where the same issue keeps coming back, by ward and city.'],
  [CloudRain, 'Predictive risk alerts', 'Rain forecast × complaint history flags waterlogging and pothole risk early.'],
  [Globe2, 'Public transparency dashboard', 'Ward scorecard plus CSV/JSON open data, privacy-safe by design.'],
  [Languages, 'Hindi / local language', 'Full Hindi interface, Hindi voice input and Hinglish-aware AI.'],
  [WifiOff, 'Offline & low-bandwidth mode', 'Reports queue offline and sync later; Lite mode drops map tiles and shrinks photos.'],
  [Plug, 'Integration with govt services', 'Open311 GeoReport v2 with a shared case ID, plus signed webhooks.'],
  [ShieldCheck, 'Role-based access', 'Citizen, officer and admin permissions enforced on the server for every request.'],
  [Star, 'Community feedback & ratings', '"Me too" votes raise priority; citizens rate fixes or reopen them.'],
  [Building2, 'Scalable multi-city deployment', 'Stateless serverless API, per-city departments and wards, indexed MongoDB.'],
];

const STEPS = [
  [Camera, 'Report', 'Type, speak, chat or snap a photo. You get a reference ID instantly.'],
  [Bot, 'AI triage & routing', 'Category, summary and priority with reasons, then the right team.'],
  [Users, 'Fix within the SLA', 'Officers update progress; overdue cases escalate.'],
  [Gauge, 'Verified closure', 'After-photo checks and your rating, or reopen it.'],
];

export default function Home() {
  const { user } = useAuth();
  const { t } = usePrefs();
  const [card, setCard] = useState(null);

  useEffect(() => { api('/public/scorecard').then(({ data }) => setCard(data)).catch(() => {}); }, []);

  const total = card ? Object.values(card.byCategory).reduce((s, n) => s + n, 0) : null;
  const cta = user?.role === 'citizen' ? '/report' : user ? '/queue' : '/register';

  return (
    <div className="space-y-16">
      <section className="relative grid items-center gap-10 lg:grid-cols-2">
        <div className="pointer-events-none absolute -left-32 -top-24 -z-10 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-100 dark:bg-brand-800/30 dark:text-brand-100 dark:ring-brand-800">
            <ShieldCheck className="h-4 w-4" aria-hidden /> {t('home.badge')}
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t('home.title1')} <span className="text-brand-700 dark:text-brand-500">{t('home.title2')}</span>.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">{t('home.sub')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={cta} className="btn-primary px-6 py-3 text-base shadow-lg shadow-brand-700/20">{user && user.role !== 'citizen' ? t('nav.queue') : t('home.cta')}</Link>
            <Link to="/scorecard" className="btn-secondary px-6 py-3 text-base">{t('home.cta2')}</Link>
          </div>
          {total != null && (
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              <div><dt className="text-xs text-slate-500">{t('home.reports')}</dt><dd className="text-2xl font-bold tabular-nums">{total}</dd></div>
              <div><dt className="text-xs text-slate-500">{t('home.wards')}</dt><dd className="text-2xl font-bold tabular-nums">{card.wards.length}</dd></div>
              <div><dt className="text-xs text-slate-500">{t('home.cities')}</dt><dd className="text-2xl font-bold tabular-nums">2</dd></div>
            </dl>
          )}
        </div>
        <div className="card p-3">
          <PointsMap points={card?.points || []} hotspots={card?.hotspots || []} height={400} />
          <div className="px-1 pb-1"><MapLegend /></div>
          <p className="px-1 text-xs text-slate-500">{t('home.rounded')}</p>
        </div>
      </section>

      <RiskAlerts title={t('home.alerts')} limit={4} />

      <section>
        <h2 className="text-2xl font-bold tracking-tight">{t('home.how')}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([Icon, title, text], i) => (
            <li key={title} className="card relative overflow-hidden p-5">
              <span className="absolute -right-3 -top-4 text-7xl font-black text-slate-100 dark:text-slate-800" aria-hidden>{i + 1}</span>
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-800/30 dark:text-brand-100"><Icon className="h-5 w-5" aria-hidden /></span>
              <h3 className="relative mt-3 font-semibold">{title}</h3>
              <p className="relative mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t('home.features')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('home.featuresSub')}</p>
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            <Accessibility className="h-3.5 w-3.5" aria-hidden /> Keyboard &amp; screen-reader friendly
          </p>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([Icon, title, text], i) => (
            <li key={title} className="card group flex gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-800">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm"><Icon className="h-5 w-5" aria-hidden /></span>
              <div>
                <h3 className="text-sm font-semibold"><span className="mr-1 text-slate-400">{String(i + 1).padStart(2, '0')}</span>{title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Timer className="h-12 w-12 shrink-0 text-brand-100" aria-hidden />
          <div className="flex-1">
            <h2 className="text-xl font-semibold">AI recommends. Rules validate. People decide.</h2>
            <p className="mt-1 text-sm text-brand-100">AI suggestions are always labelled and never block your report. Every change records who, when and why, in a hash-chained audit trail.</p>
          </div>
          <Link to="/scorecard" className="btn bg-white text-brand-800 hover:bg-brand-50">View transparency data</Link>
        </div>
      </section>
    </div>
  );
}
