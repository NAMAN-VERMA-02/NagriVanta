import { Link } from 'react-router';
import { MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-ink-900">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white"><MapPin className="h-4 w-4" aria-hidden /></span>
            CivicLens
          </div>
          <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Report civic issues, follow them to resolution with a full audit trail, and see how each ward is doing.
            AI suggests; authorised staff decide.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Platform</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li><Link className="hover:text-brand-700 dark:hover:text-brand-500" to="/report">Report an issue</Link></li>
            <li><Link className="hover:text-brand-700 dark:hover:text-brand-500" to="/my-reports">Track my reports</Link></li>
            <li><Link className="hover:text-brand-700 dark:hover:text-brand-500" to="/scorecard">Public scorecard</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Data & credits</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>Maps © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</li>
            <li>Evaluation data: <a className="underline" href="https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9" target="_blank" rel="noreferrer">NYC Open Data 311</a></li>
            <li>Demo complaints are synthetic</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 dark:border-slate-800">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} CivicLens · Independent pilot project, not an official government system. In an emergency call 112.
        </p>
      </div>
    </footer>
  );
}
