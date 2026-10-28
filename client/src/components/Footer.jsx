import { Link } from 'react-router';
import { MapPin } from 'lucide-react';
import { usePrefs } from '../context/PrefsContext';
import { API_ORIGIN } from '../services/api';

export default function Footer() {
  const { t } = usePrefs();
  const linkCls = 'hover:text-brand-700 dark:hover:text-brand-500';
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-ink-900">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-white"><MapPin className="h-4 w-4" aria-hidden /></span>
            NagriVanta
          </div>
          <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">{t('footer.about')}</p>
          <p className="mt-3 text-xs text-slate-500">Web · Android/iOS app · Voice · Chat · Open311 API</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">{t('footer.platform')}</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li><Link className={linkCls} to="/report">{t('nav.report')}</Link></li>
            <li><Link className={linkCls} to="/my-reports">{t('nav.mine')}</Link></li>
            <li><Link className={linkCls} to="/community">{t('nav.community')}</Link></li>
            <li><Link className={linkCls} to="/scorecard">{t('nav.scorecard')}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">{t('footer.data')}</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li><a className={linkCls} href={`${API_ORIGIN}/api/v1/public/open-data.csv`}>Open data (CSV, CC BY 4.0)</a></li>
            <li><a className={linkCls} href={`${API_ORIGIN}/open311/v2/services.json`} target="_blank" rel="noreferrer">Open311 GeoReport v2 API</a></li>
            <li>Maps © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Weather: <a className="underline" href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a></li>
            <li>Training data: <a className="underline" href="https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9" target="_blank" rel="noreferrer">NYC 311</a> + synthetic demo set</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-800">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} NagriVanta · {t('footer.disclaimer')}
        </p>
      </div>
    </footer>
  );
}
