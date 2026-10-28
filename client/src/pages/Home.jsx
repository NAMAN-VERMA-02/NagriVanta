import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight, BarChart3, Bell, Bot, Brain, Building2, Camera, ClipboardCheck, CloudRain, Copy, Globe2, Languages, Layers,
  Plug, Route, Search, ShieldCheck, Sparkles, Star, Timer, WifiOff,
} from 'lucide-react';
import { RiskAlerts } from '../components/Insights';
import { MapLegend, PointsMap } from '../components/Maps';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { useCountUp, useReveal } from '../hooks/useMotion';
import { api } from '../services/api';

// The 18 capabilities from the comparison study, grouped by where they sit in a case's journey.
const JOURNEY = [
  ['Report', 'Any channel, any language', [
    [Layers, 'Multi-channel intake', 'Web, app, voice, AI chat and Open311 all create the same case.'],
    [Camera, 'Photo & video with metadata', 'Capture time and GPS read from the photo.'],
    [Languages, 'Hindi and local language', 'Hindi interface, Hindi voice input, Hinglish-aware AI.'],
    [WifiOff, 'Offline & low bandwidth', 'Reports queue offline; Lite mode saves data.'],
  ]],
  ['Triage & route', 'AI suggests, people decide', [
    [Brain, 'AI classification', 'Gemini reads the text and the photo; an offline model answers instantly.'],
    [Sparkles, 'Summary & priority', 'Explainable priority score with every factor listed.'],
    [Route, 'Smart routing', 'Right department, least-loaded officer.'],
    [Copy, 'Duplicate detection', 'Text, distance, category and photo similarity.'],
  ]],
  ['Fix & verify', 'Deadlines and real proof', [
    [Timer, 'SLA & escalation', 'Due dates per priority; overdue cases escalate.'],
    [Bell, 'Live tracking', 'Timeline and notifications at every step.'],
    [ClipboardCheck, 'Before/after evidence', 'Fresh photo, reuse and location checks, AI comparison.'],
    [Star, 'Community feedback', '"Me too" votes, ratings and reopening.'],
  ]],
  ['Govern in the open', 'Data that helps cities plan', [
    [BarChart3, 'Ward analytics & heatmap', 'Recurring hotspots by ward and city.'],
    [CloudRain, 'Predictive risk alerts', 'Rain forecast × complaint history.'],
    [Globe2, 'Transparency & open data', 'Public scorecard, CSV/JSON open data.'],
    [Plug, 'Government integration', 'Open311 API and signed webhooks.'],
    [ShieldCheck, 'Role-based access', 'Citizen, officer and admin, checked on the server.'],
    [Building2, 'Multi-city', 'Per-city departments, wards and filters.'],
  ]],
];

const STEPS = [
  [Camera, 'Report it', 'Type, speak, chat or snap a photo. You get a reference ID at once.'],
  [Bot, 'It reaches the right team', 'AI suggests the category and priority; routing assigns an officer.'],
  [Timer, 'Fixed on a deadline', 'Every case has a target date. Late ones escalate automatically.'],
  [ClipboardCheck, 'Proof you can check', 'See the after-photo and its checks, then rate it or reopen it.'],
];

function Count({ value }) {
  const n = useCountUp(value);
  return <>{n.toLocaleString('en-IN')}</>;
}

export default function Home() {
  const { user } = useAuth();
  const { t } = usePrefs();
  const [card, setCard] = useState(null);
  const ref = useReveal();

  useEffect(() => { api('/public/scorecard').then(({ data }) => setCard(data)).catch(() => {}); }, []);

  const total = card ? Object.values(card.byCategory).reduce((s, n) => s + n, 0) : null;
  const staff = user && user.role !== 'citizen';
  const cta = user?.role === 'citizen' ? '/report' : staff ? '/queue' : '/register';

  return (
    <div ref={ref} className="space-y-20">
      <section className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-rise">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {t('home.title1')} <span className="text-brand-700 dark:text-brand-500">{t('home.title2')}</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">{t('home.sub')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={cta} className="btn-primary group px-6 py-3 text-base">
              {staff ? t('nav.queue') : t('home.cta')}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
            </Link>
            {!user ? <Link to="/track" className="btn-secondary px-6 py-3 text-base"><Search className="h-4 w-4" aria-hidden />{t('nav.track')}</Link>
              : <Link to="/scorecard" className="btn-secondary px-6 py-3 text-base">{t('home.cta2')}</Link>}
          </div>
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-slate-200 pt-6 dark:border-slate-800">
            <div><dt className="text-sm text-slate-500 dark:text-slate-400">{t('home.reports')}</dt><dd className="text-3xl font-bold tabular-nums">{total != null ? <Count value={total} /> : '—'}</dd></div>
            <div><dt className="text-sm text-slate-500 dark:text-slate-400">{t('home.wards')}</dt><dd className="text-3xl font-bold tabular-nums">{card ? <Count value={card.wards.length} /> : '—'}</dd></div>
            <div><dt className="text-sm text-slate-500 dark:text-slate-400">{t('home.cities')}</dt><dd className="text-3xl font-bold tabular-nums">2</dd></div>
          </dl>
        </div>
        {/* the page's one authored moment: the live map rises into place */}
        <div className="animate-[pop_0.9s_var(--ease-out-expo)_0.15s_both] rounded-3xl border border-slate-200 bg-white p-2.5 shadow-[0_30px_60px_-30px_rgb(15_23_42/0.45)] dark:border-slate-800 dark:bg-ink-900">
          <PointsMap points={card?.points || []} hotspots={card?.hotspots || []} height={420} />
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-2">
            <MapLegend />
            <p className="text-xs text-slate-500">{t('home.rounded')}</p>
          </div>
        </div>
      </section>

      <div data-reveal><RiskAlerts title={t('home.alerts')} limit={4} /></div>

      <section data-reveal>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('home.how')}</h2>
        <ol className="relative mt-8 grid gap-8 md:grid-cols-4 md:gap-6">
          <span className="absolute left-5 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-slate-200 md:block dark:bg-ink-700" aria-hidden />
          {STEPS.map(([Icon, title, text]) => (
            <li key={title} className="relative flex gap-4 md:block">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white ring-8 ring-slate-50 dark:ring-ink-950"><Icon className="h-5 w-5" aria-hidden /></span>
              <div className="md:mt-4">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        {!user && <Link to="/how-it-works" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-500">Read the full guide <ArrowRight className="h-4 w-4" aria-hidden /></Link>}
      </section>

      <section data-reveal>
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('home.features')}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">{t('home.featuresSub')}</p>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
          {JOURNEY.map(([stage, line, items]) => (
            <div key={stage} className="bg-white p-6 dark:bg-ink-900">
              <h3 className="text-lg font-bold">{stage}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{line}</p>
              <ul className="mt-5 space-y-4">
                {items.map(([Icon, title, text]) => (
                  <li key={title} className="group flex gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 transition-transform duration-300 group-hover:scale-110 dark:text-brand-500" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section data-reveal className="overflow-hidden rounded-3xl bg-brand-800 p-8 text-white sm:p-10 dark:bg-brand-900">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 className="text-2xl font-bold">AI recommends. Rules validate. People decide.</h2>
            <p className="mt-2 max-w-2xl text-brand-100">AI suggestions are always labelled and never block your report. Every change records who, when and why, in a tamper-evident history.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={user ? '/scorecard' : '/about'} className="btn bg-white text-brand-800 hover:bg-brand-50">{user ? 'View transparency data' : 'About NagriVanta'}</Link>
            {!user && <Link to="/faq" className="btn border border-white/30 text-white hover:bg-white/10">FAQ</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}
