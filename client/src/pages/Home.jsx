import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Camera, ClipboardCheck, ShieldCheck, Sparkles, Timer, Users } from 'lucide-react';
import { MapLegend, PointsMap } from '../components/Maps';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const STEPS = [
  { icon: Camera, title: 'Report', text: 'Describe the issue, drop a pin, add a photo. You get a reference ID instantly.' },
  { icon: Sparkles, title: 'AI-assisted triage', text: 'Suggested category, summary and priority with reasons. Staff confirm or correct.' },
  { icon: Users, title: 'Assign with an SLA', text: 'Routed to a department with a due date. Overdue cases escalate automatically.' },
  { icon: ClipboardCheck, title: 'Resolve with evidence', text: 'Closure needs a note and an after-photo. You can rate it or reopen it.' },
];

export default function Home() {
  const { user } = useAuth();
  const [card, setCard] = useState(null);

  useEffect(() => { api('/public/scorecard').then(({ data }) => setCard(data)).catch(() => {}); }, []);

  const total = card ? Object.values(card.byCategory).reduce((s, n) => s + n, 0) : null;
  const cta = user?.role === 'citizen' ? '/report' : user ? '/queue' : '/register';

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-800/30 dark:text-brand-100">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Accountable, auditable, citizen-first
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            From pothole to <span className="text-brand-700 dark:text-brand-500">proof of fix</span>.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            Report potholes, garbage, leaks, dark streetlights and blocked drains. Follow every step with a timeline,
            a deadline and evidence of resolution.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={cta} className="btn-primary px-6 py-3 text-base">{user?.role === 'citizen' ? 'Report an issue' : user ? 'Open my queue' : 'Report an issue'}</Link>
            <Link to="/scorecard" className="btn-secondary px-6 py-3 text-base">See ward scorecard</Link>
          </div>
          {total != null && (
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              <div><dt className="text-xs text-slate-500">Reports</dt><dd className="text-2xl font-bold">{total}</dd></div>
              <div><dt className="text-xs text-slate-500">Wards</dt><dd className="text-2xl font-bold">{card.wards.length}</dd></div>
              <div><dt className="text-xs text-slate-500">Categories</dt><dd className="text-2xl font-bold">{Object.keys(card.byCategory).length}</dd></div>
            </dl>
          )}
        </div>
        <div className="card p-3">
          <PointsMap points={card?.points || []} height={400} />
          <div className="px-1 pb-1"><MapLegend /></div>
          <p className="px-1 text-xs text-slate-500">Locations rounded to ~100 m for privacy.</p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-800/30 dark:text-brand-100"><Icon className="h-5 w-5" aria-hidden /></span>
                <span className="text-xs font-semibold text-slate-400">Step {i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center">
        <Timer className="h-10 w-10 shrink-0 text-brand-700 dark:text-brand-500" aria-hidden />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">AI recommends. Rules validate. People decide.</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            AI suggestions are always labelled and never block your report. Every status change records who, when and why.
          </p>
        </div>
        <Link to="/scorecard" className="btn-secondary">View transparency data</Link>
      </section>
    </div>
  );
}
