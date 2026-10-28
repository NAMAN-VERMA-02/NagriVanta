import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUp, CodeXml, Download, FileSpreadsheet, MapPin, Plus, Search, Smartphone, Webhook } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { API_ORIGIN } from '../services/api';

const REPO = 'https://github.com/NAMAN-VERMA-02/NagriVanta';

const PLATFORM = {
  guest: [['/report', 'nav.report'], ['/track', 'nav.track'], ['/scorecard', 'nav.scorecard'], ['/register', 'nav.start']],
  citizen: [['/report', 'nav.report'], ['/my-reports', 'nav.mine'], ['/community', 'nav.community'], ['/scorecard', 'nav.scorecard'], ['/profile', 'nav.profile']],
  officer: [['/queue', 'nav.myqueue'], ['/analytics', 'nav.analytics'], ['/scorecard', 'nav.scorecard'], ['/profile', 'nav.profile']],
  admin: [['/queue', 'nav.queue'], ['/analytics', 'nav.analytics'], ['/scorecard', 'nav.scorecard'], ['/profile', 'nav.profile']],
};
const RESOURCES = [['/how-it-works', 'nav.guide'], ['/faq', 'nav.faq'], ['/about', 'nav.about'], ['/track', 'nav.track']];

// Live API status, checked once per page load.
function useApiStatus() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    fetch(`${API_ORIGIN}/health`, { signal: ctl.signal }).then((r) => r.json()).then((d) => setStatus(d.status === 'ok' ? 'up' : 'down')).catch(() => setStatus('down')).finally(() => clearTimeout(timer));
    return () => { ctl.abort(); clearTimeout(timer); };
  }, []);
  return status;
}

function useInstall() {
  const [prompt, setPrompt] = useState(() => window.__installPrompt || null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches);
  useEffect(() => {
    const avail = () => setPrompt(window.__installPrompt);
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('install:available', avail);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('install:available', avail); window.removeEventListener('appinstalled', done); };
  }, []);
  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    window.__installPrompt = null;
    setPrompt(null);
  };
  return { canInstall: Boolean(prompt), installed, install };
}

function Col({ title, children }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

const linkCls = 'group inline-flex items-center gap-1 text-slate-600 transition-colors hover:text-brand-700 dark:text-slate-300 dark:hover:text-brand-400';

export default function Footer() {
  const { t } = usePrefs();
  const { user } = useAuth();
  const status = useApiStatus();
  const { canInstall, installed, install } = useInstall();
  const role = user?.role || 'guest';
  const showCta = role === 'guest' || role === 'citizen';
  const dot = { up: 'bg-emerald-500', down: 'bg-red-500', checking: 'bg-slate-400' }[status];

  return (
    <footer className="mt-20 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-ink-900">
      {showCta && (
        <div className="mx-auto max-w-7xl px-4">
          <div className="relative -mt-12 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-950 px-6 py-8 text-white shadow-[0_30px_60px_-30px_rgb(15_118_110/0.7)] sm:px-10 sm:py-10">
            <svg className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 text-white/10" viewBox="0 0 200 200" aria-hidden>
              <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="100" cy="100" r="98" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('ftr.ctaTitle')}</h2>
                <p className="mt-2 text-brand-100">{t('ftr.ctaBody')}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/report" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-brand-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><Plus className="h-4 w-4" aria-hidden />{t('nav.report')}</Link>
                <Link to="/track" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"><Search className="h-4 w-4" aria-hidden />{t('nav.track')}</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-12">
        <div className="sm:col-span-2 lg:col-span-4">
          <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white"><MapPin className="h-5 w-5" aria-hidden /></span>
            Nagri<span className="-ml-2.5 text-brand-700 dark:text-brand-500">Vanta</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t('footer.about')}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a href={`${API_ORIGIN}/health`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 dark:border-ink-700 dark:text-slate-300">
              <span className="relative flex h-2 w-2">
                {status === 'up' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
              </span>
              {t(status === 'up' ? 'ftr.online' : status === 'down' ? 'ftr.offline' : 'ftr.checking')}
            </a>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-ink-800 dark:text-slate-300">{t('ftr.made')}</span>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Col title={t('footer.platform')}>
            {PLATFORM[role].map(([to, key]) => <li key={to}><Link className={linkCls} to={to}>{t(key)}</Link></li>)}
          </Col>
        </div>
        <div className="lg:col-span-2">
          <Col title={t('ftr.resources')}>
            {RESOURCES.map(([to, key]) => <li key={to}><Link className={linkCls} to={to}>{t(key)}</Link></li>)}
          </Col>
        </div>
        <div className="lg:col-span-2">
          <Col title={t('footer.data')}>
            <li><a className={linkCls} href={`${API_ORIGIN}/api/v1/public/open-data.csv`}><FileSpreadsheet className="h-4 w-4 opacity-60" aria-hidden />Open data CSV</a></li>
            <li><a className={linkCls} href={`${API_ORIGIN}/api/v1/public/open-data.json`} target="_blank" rel="noreferrer"><FileSpreadsheet className="h-4 w-4 opacity-60" aria-hidden />Open data JSON</a></li>
            <li><a className={linkCls} href={`${API_ORIGIN}/open311/v2/services.json`} target="_blank" rel="noreferrer"><Webhook className="h-4 w-4 opacity-60" aria-hidden />Open311 API</a></li>
            <li><a className={linkCls} href={REPO} target="_blank" rel="noreferrer"><CodeXml className="h-4 w-4 opacity-60" aria-hidden />{t('ftr.source')}</a></li>
          </Col>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <Col title={t('ftr.app')}>
            <li className="text-slate-600 dark:text-slate-400">{t('ftr.appBody')}</li>
            <li>
              {installed ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"><Smartphone className="h-4 w-4" aria-hidden />{t('ftr.installed')}</span>
              ) : canInstall ? (
                <button type="button" onClick={install} className="btn-primary h-10 rounded-full"><Download className="h-4 w-4" aria-hidden />{t('ftr.install')}</button>
              ) : (
                <Link to="/faq" className={`${linkCls} font-medium`}><Smartphone className="h-4 w-4" aria-hidden />Android · iOS · Desktop<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden /></Link>
              )}
            </li>
          </Col>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
          <p>© {new Date().getFullYear()} NagriVanta · {t('footer.disclaimer')}</p>
          <div className="flex items-center gap-4">
            <span>Maps © <a className="underline-offset-2 hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Weather <a className="underline-offset-2 hover:underline" href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a></span>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label={t('ftr.top')} title={t('ftr.top')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:text-slate-300">
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
