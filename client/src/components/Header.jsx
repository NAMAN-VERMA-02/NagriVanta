import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Bell, Feather, LogOut, MapPin, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { api } from '../services/api';
import ThemeToggle from './ThemeToggle';

const NAV = {
  guest: [['/scorecard', 'nav.scorecard']],
  citizen: [['/report', 'nav.report'], ['/my-reports', 'nav.mine'], ['/community', 'nav.community'], ['/scorecard', 'nav.scorecard']],
  officer: [['/queue', 'nav.myqueue'], ['/analytics', 'nav.analytics'], ['/scorecard', 'nav.scorecard']],
  admin: [['/queue', 'nav.queue'], ['/analytics', 'nav.analytics'], ['/scorecard', 'nav.scorecard']],
};

// Polls for notifications and raises a browser notification for new ones (works on serverless hosts, no sockets).
function useNotifications(user) {
  const [unread, setUnread] = useState(0);
  const seen = useRef(null);
  const location = useLocation();
  useEffect(() => {
    if (!user) return undefined;
    const load = () => api('/notifications').then(({ data, meta }) => {
      setUnread(meta?.unread || 0);
      const newest = data[0];
      if (seen.current && newest && newest._id !== seen.current && !newest.readAt && document.hidden && window.Notification?.permission === 'granted') {
        new window.Notification(newest.title, { body: newest.message || '', icon: '/icon.svg' });
      }
      if (newest) seen.current = newest._id;
    }).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [user, location.pathname]);
  return unread;
}

export default function Header() {
  const { user, logout } = useAuth();
  const { t, lang, toggleLang, lite, toggleLite } = usePrefs();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useNotifications(user);
  const links = NAV[user?.role || 'guest'];

  useEffect(() => setOpen(false), [location.pathname]);

  const linkCls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive
    ? 'bg-brand-50 text-brand-800 dark:bg-brand-800/30 dark:text-brand-100'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`;
  const signOut = async () => { await logout(); navigate('/'); };

  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200/80 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-ink-950/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded focus:bg-brand-700 focus:px-3 focus:py-1 focus:text-white">Skip to content</a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-sm shadow-brand-700/30"><MapPin className="h-5 w-5" aria-hidden /></span>
          <span className="text-lg">Nagri<span className="text-brand-700 dark:text-brand-500">Vanta</span></span>
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
          {links.map(([to, key]) => <NavLink key={to} to={to} className={linkCls}>{t(key)}</NavLink>)}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={toggleLang} className="btn-ghost h-10 rounded-full px-3 text-xs font-bold" aria-label={lang === 'en' ? 'हिंदी में देखें' : 'View in English'} title={lang === 'en' ? 'हिंदी' : 'English'}>
            {lang === 'en' ? 'हिं' : 'EN'}
          </button>
          <button type="button" onClick={toggleLite} aria-pressed={lite} title={t('lite.hint')} aria-label={t('lite.hint')}
            className={`btn-ghost h-10 w-10 rounded-full p-0 ${lite ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : ''}`}>
            <Feather className="h-5 w-5" aria-hidden />
          </button>
          <ThemeToggle />
          {user && (
            <Link to="/notifications" className="btn-ghost relative h-10 w-10 rounded-full p-0" aria-label={`Notifications, ${unread} unread`}
              onClick={() => window.Notification?.permission === 'default' && window.Notification.requestPermission()}>
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          )}
          {user ? (
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-right text-xs leading-tight">
                <span className="block font-semibold">{user.name}</span>
                <span className="capitalize text-slate-500 dark:text-slate-400">{user.role}{user.city ? ` · ${user.city}` : ''}</span>
              </span>
              <button type="button" className="btn-ghost h-10 w-10 rounded-full p-0" aria-label={t('nav.signout')} onClick={signOut}>
                <LogOut className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="hidden gap-2 lg:flex">
              <Link to="/login" className="btn-ghost">{t('nav.signin')}</Link>
              <Link to="/register" className="btn-primary">{t('nav.start')}</Link>
            </div>
          )}
          <button type="button" className="btn-ghost h-10 w-10 rounded-full p-0 lg:hidden" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="border-t border-slate-200 px-4 py-3 lg:hidden dark:border-slate-800">
          <div className="flex flex-col gap-1">
            {links.map(([to, key]) => <NavLink key={to} to={to} className={linkCls}>{t(key)}</NavLink>)}
            {user ? (
              <button type="button" className="btn-secondary mt-2" onClick={signOut}><LogOut className="h-4 w-4" aria-hidden /> {t('nav.signout')} ({user.name})</button>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to="/login" className="btn-secondary">{t('nav.signin')}</Link>
                <Link to="/register" className="btn-primary">{t('nav.start')}</Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
