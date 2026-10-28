import { Link } from 'react-router';
import { CodeXml, Eye, HeartHandshake, Lock, Phone, Scale } from 'lucide-react';
import { usePrefs } from '../context/PrefsContext';
import { useReveal } from '../hooks/useMotion';

const PRINCIPLES = [
  [Eye, 'Transparent by default', 'Every step of a case is visible to the person who reported it, and city-wide numbers are public on the scorecard and as open data.'],
  [Scale, 'People decide, AI assists', 'AI suggests a category, summary and priority with its reasons. Authorised staff confirm every decision, and every change is logged.'],
  [Lock, 'Private where it matters', 'Names, contact details and exact locations are visible only to staff handling the case. Public views are anonymised and rounded.'],
  [HeartHandshake, 'Built for everyone', 'Hindi and English, voice input, keyboard and screen-reader support, and a Lite mode that works on slow connections or offline.'],
];

export default function About() {
  const { lang } = usePrefs();
  const ref = useReveal();
  return (
    <div ref={ref} className="mx-auto max-w-4xl">
      <header data-reveal className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{lang === 'hi' ? 'NagriVanta के बारे में' : 'About NagriVanta'}</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
          {lang === 'hi'
            ? 'NagriVanta नागरिकों और नगर निकायों को जोड़ता है: शिकायत आसानी से दर्ज हो, सही विभाग तक पहुँचे, समय पर ठीक हो और मरम्मत का सबूत सबको दिखे।'
            : 'NagriVanta connects citizens with the people who fix their streets: a report that is easy to file, reaches the right department, is fixed on time, and ends with proof everyone can see.'}
        </p>
      </header>

      <section data-reveal className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {PRINCIPLES.map(([Icon, title, text]) => (
          <div key={title}>
            <Icon className="h-6 w-6 text-brand-700 dark:text-brand-500" aria-hidden />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{text}</p>
          </div>
        ))}
      </section>

      <section data-reveal className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-ink-900">
        <h2 className="text-xl font-bold">What NagriVanta is, and is not</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <ul className="space-y-2 text-slate-600 dark:text-slate-300">
            <li>An independent pilot for Ghaziabad and Noida, ready to add more cities.</li>
            <li>Open source, with a standard Open311 API for municipal systems.</li>
            <li>Open data under CC BY 4.0 for researchers and journalists.</li>
          </ul>
          <ul className="space-y-2 text-slate-600 dark:text-slate-300">
            <li>Not an official government portal, and not an emergency service.</li>
            <li>The demo uses synthetic data; numbers shown are not official statistics.</li>
            <li>AI accuracy claims are only made with measured evidence.</li>
          </ul>
        </div>
      </section>

      <section data-reveal className="mt-12 grid gap-6 sm:grid-cols-2">
        <div className="rounded-3xl bg-red-50 p-6 text-red-900 dark:bg-red-950/40 dark:text-red-100">
          <Phone className="h-6 w-6" aria-hidden />
          <h2 className="mt-3 font-semibold">In an emergency</h2>
          <p className="mt-1">Call <a href="tel:112" className="font-bold underline">112</a> (national emergency number) for police, fire or ambulance. For gas leaks, fallen live wires or collapsed structures, call 112 first and report here afterwards.</p>
        </div>
        <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 dark:bg-ink-900 dark:ring-slate-800">
          <CodeXml className="h-6 w-6 text-brand-700 dark:text-brand-500" aria-hidden />
          <h2 className="mt-3 font-semibold">Open source</h2>
          <p className="mt-1 text-slate-600 dark:text-slate-300">The code, documentation and datasets are public.</p>
          <a href="https://github.com/NAMAN-VERMA-02/NagriVanta" target="_blank" rel="noreferrer" className="mt-3 inline-block font-semibold text-brand-700 hover:underline dark:text-brand-500">View on GitHub</a>
        </div>
      </section>

      <div data-reveal className="mt-10 flex flex-wrap gap-3">
        <Link to="/how-it-works" className="btn-primary px-6 py-3">How it works</Link>
        <Link to="/scorecard" className="btn-secondary px-6 py-3">See the public scorecard</Link>
      </div>
    </div>
  );
}
