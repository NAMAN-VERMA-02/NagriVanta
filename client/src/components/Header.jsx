import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Bell, LogOut, MapPin, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import ThemeToggle from './ThemeToggle';

const NAV = {
  guest: [{ to: '/scorecard', label: 'Public scorecard' }],
  citizen: [
    { to: '/report', label: 'Report issue' },
    { to: '/my-reports', label: 'My reports' },
    { to: '/scorecard', label: 'Public scorecard' },
  ],
  officer: [
    { to: '/queue', label: 'My queue' },
    { to: '/analytics', label: 'Analytics' },
    { to: '/scorecard', label: 'Scorecard' },
  ],
  admin: [
    { to: '/queue', label: 'Triage queue' },
    { to: '/analytics', label: 'Analytics' },
    { to: '/scorecard', label: 'Scorecard' },
  ],
};

export default function Header() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const links = NAV[user?.role || 'guest'];

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!user) return undefined;
    const load = () => api('/notifications').then(({ meta }) => setUnread(meta?.unread || 0)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [user, location.pathname]);

  const linkCls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive
    ? 'bg-brand-50 text-brand-800 dark:bg-brand-800/30 dark:text-brand-100'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`;

  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-ink-950/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded focus:bg-brand-700 focus:px-3 focus:py-1 focus:text-white">Skip to content</a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white"><MapPin className="h-5 w-5" aria-hidden /></span>
          <span className="text-lg">Civic<span className="text-brand-700 dark:text-brand-500">Lens</span></span>
        </Link>

        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((l) => <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>)}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {user && (
            <Link to="/notifications" className="btn-ghost relative h-10 w-10 rounded-full p-0" aria-label={`Notifications, ${unread} unread`}>
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          )}
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-right text-xs leading-tight">
                <span className="block font-semibold">{user.name}</span>
                <span className="capitalize text-slate-500 dark:text-slate-400">{user.role}</span>
              </span>
              <button type="button" className="btn-ghost h-10 w-10 rounded-full p-0" aria-label="Sign out" onClick={async () => { await logout(); navigate('/'); }}>
                <LogOut className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="hidden gap-2 md:flex">
              <Link to="/login" className="btn-ghost">Sign in</Link>
              <Link to="/register" className="btn-primary">Get started</Link>
            </div>
          )}
          <button type="button" className="btn-ghost h-10 w-10 rounded-full p-0 md:hidden" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-slate-200 px-4 py-3 md:hidden dark:border-slate-800">
          <div className="flex flex-col gap-1">
            {links.map((l) => <NavLink key={l.to} to={l.to} className={linkCls}>{l.label}</NavLink>)}
            {user ? (
              <button type="button" className="btn-secondary mt-2" onClick={async () => { await logout(); navigate('/'); }}>
                <LogOut className="h-4 w-4" aria-hidden /> Sign out ({user.name})
              </button>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to="/login" className="btn-secondary">Sign in</Link>
                <Link to="/register" className="btn-primary">Get started</Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
