import { CircleAlert, LoaderCircle } from 'lucide-react';
import { usePrefs } from '../context/PrefsContext';
import { CATEGORY_HI, STATUS_HI } from '../i18n';
import { PRIORITY, STATUS, categoryLabel } from '../utils/format';

export function StatusBadge({ status }) {
  const { lang } = usePrefs();
  const s = STATUS[status] || { label: status, cls: '' };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{lang === 'hi' ? STATUS_HI[status] || s.label : s.label}</span>;
}

export function PriorityBadge({ priority }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PRIORITY[priority] || ''}`}>{priority}</span>;
}

export function CategoryBadge({ category }) {
  const { lang } = usePrefs();
  return <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-800/30 dark:text-brand-100">{lang === 'hi' ? CATEGORY_HI[category] || category : categoryLabel(category)}</span>;
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-slate-500">
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        {error.message || String(error)}
        {error.details?.length > 0 && (
          <ul className="mt-1 list-disc pl-4">{error.details.map((d) => <li key={d.field}>{d.field}: {d.message}</li>)}</ul>
        )}
      </div>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="card p-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Stat({ label, value, hint, tone = '' }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value ?? '—'}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
