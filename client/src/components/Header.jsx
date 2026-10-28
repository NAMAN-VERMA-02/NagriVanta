import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Bell, ChevronDown, Feather, LogOut, MapPin, Menu, UserRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { api } from '../services/api';
import ThemeToggle from './ThemeToggle';
import { Avatar } from './ui';

const NAV = {
  guest: [['/how-it-works', 'nav.guide'], ['/track', 'nav.track'], ['/scorecard', 'nav.scorecard'], ['/about', 'nav.about'], ['/faq', 'nav.faq']],
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

function UserMenu({ user, onSignOut }) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100 dark:hover:bg-slate-800">
        <Avatar name={user.name} size="sm" />
        <span className="hidden text-left text-xs leading-tight xl:block">
          <span className="block max-w-32 truncate font-semibold">{user.name}</span>
          <span className="capitalize text-slate-500 dark:text-slate-400">{user.role}{user.city ? ` · ${user.city}` : ''}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 origin-top-right animate-pop rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_16px_40px_-16px_rgb(15_23_42/0.4)] dark:border-ink-700 dark:bg-ink-900">
          <div className="flex items-center gap-3 border-b border-slate-100 px-2 pb-3 pt-1 dark:border-ink-700">
            <Avatar name={user.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
          </div>
          <Link role="menuitem" to="/profile" className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-100 dark:hover:bg-ink-800"><UserRound className="h-4 w-4" aria-hidden /> {t('nav.profile')}</Link>
          <Link role="menuitem" to="/notifications" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-100 dark:hover:bg-ink-800"><Bell className="h-4 w-4" aria-hidden /> {t('nav.notifications')}</Link>
          <button role="menuitem" type="button" onClick={onSignOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"><LogOut className="h-4 w-4" aria-hidden /> {t('nav.signout')}</button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const { t, lang, toggleLang, lite, toggleLite } = usePrefs();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useNotifications(user);
  const links = NAV[user?.role || 'guest'];

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkCls = ({ isActive }) => `relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive
    ? 'text-brand-800 after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-brand-600 dark:text-brand-100 dark:after:bg-brand-500'
    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`;
  const mobileCls = ({ isActive }) => `rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-800 dark:bg-brand-800/30 dark:text-brand-100' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`;
  const signOut = async () => { await logout(); navigate('/'); };

  return (
    <header className={`sticky top-0 z-[1000] border-b backdrop-blur-lg transition-[background-color,border-color,box-shadow] duration-300 ${scrolled
      ? 'border-slate-200/80 bg-white/85 shadow-[0_6px_20px_-14px_rgb(15_23_42/0.35)] dark:border-slate-800 dark:bg-ink-950/85'
      : 'border-transparent bg-slate-50/70 dark:bg-ink-950/70'}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded focus:bg-brand-700 focus:px-3 focus:py-1 focus:text-white">Skip to content</a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="group flex items-center gap-2 font-bold tracking-tight" aria-label="NagriVanta home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white shadow-[0_6px_14px_-6px_rgb(15_118_110/0.8)] transition-transform duration-300 group-hover:-rotate-6"><MapPin className="h-5 w-5" aria-hidden /></span>
          <span className="text-lg">Nagri<span className="text-brand-700 dark:text-brand-500">Vanta</span></span>
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-0.5 lg:flex">
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
              {unread > 0 && <span key={unread} className="absolute right-1 top-1 min-w-4 animate-pop rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          )}
          {user ? (
            <div className="hidden lg:block"><UserMenu user={user} onSignOut={signOut} /></div>
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
        <nav aria-label="Mobile" className="animate-fade border-t border-slate-200 bg-white px-4 py-3 lg:hidden dark:border-slate-800 dark:bg-ink-950">
          <div className="flex flex-col gap-1">
            {user && (
              <Link to="/profile" className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-ink-900">
                <Avatar name={user.name} />
                <span className="min-w-0 text-sm"><span className="block truncate font-semibold">{user.name}</span><span className="text-xs capitalize text-slate-500">{t('nav.profile')} · {user.role}</span></span>
              </Link>
            )}
            {links.map(([to, key]) => <NavLink key={to} to={to} className={mobileCls}>{t(key)}</NavLink>)}
            {user ? (
              <button type="button" className="btn-secondary mt-2" onClick={signOut}><LogOut className="h-4 w-4" aria-hidden /> {t('nav.signout')}</button>
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
