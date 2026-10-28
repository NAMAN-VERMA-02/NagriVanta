import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ErrorBox } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const home = (role) => (role === 'citizen' ? '/my-reports' : '/queue');

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const user = await login(form);
      // keep an assistant draft so the report form opens pre-filled after sign-in
      navigate(location.state?.from || home(user.role), { replace: true, state: location.state?.draft ? { draft: location.state.draft } : undefined });
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <AuthCard title="Sign in" subtitle="Track your reports or manage your queue.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBox error={error} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-4 text-center text-sm">New here? <Link to="/register" className="font-semibold text-brand-700 dark:text-brand-500">Create an account</Link></p>
      <details className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-ink-800 dark:text-slate-300">
        <summary className="cursor-pointer font-semibold">Demo accounts (after running the seed)</summary>
        <p className="mt-2">Password for all: <code>Demo@12345</code></p>
        <ul className="mt-1 space-y-0.5">
          <li>Admin: admin@civiclens.local</li>
          <li>Officer (Ghaziabad): pwd.officer@civiclens.local (also san, jal, ele, drn)</li>
          <li>Officer (Noida): noida.pwd.officer@civiclens.local</li>
          <li>Citizen: citizen1@civiclens.local</li>
        </ul>
      </details>
    </AuthCard>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await register(form);
      navigate('/report', { replace: true });
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <AuthCard title="Create your account" subtitle="Citizens can report issues and follow every step to resolution.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBox error={error} />
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" autoComplete="name" required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="remail">Email</label>
          <input id="remail" type="email" autoComplete="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="rpass">Password</label>
          <input id="rpass" type="password" autoComplete="new-password" minLength={8} required className="input" aria-describedby="pass-hint" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p id="pass-hint" className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="mt-4 text-center text-sm">Already registered? <Link to="/login" className="font-semibold text-brand-700 dark:text-brand-500">Sign in</Link></p>
    </AuthCard>
  );
}
