import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { BarChart3, Bell, BookOpen, ChevronDown, CircleHelp, ClipboardList, Feather, Info, ListChecks, LogOut, MapPin, MapPinned, Menu, Plus, Search, Trophy, UserRound, X } from 'lucide-react';
import CommandPalette from './CommandPalette';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { api } from '../services/api';
import ThemeToggle from './ThemeToggle';
import { Avatar } from './ui';

const NAV = {
  guest: [['/how-it-works', 'nav.guide', BookOpen], ['/track', 'nav.track', Search], ['/scorecard', 'nav.scorecard', Trophy], ['/about', 'nav.about', Info], ['/faq', 'nav.faq', CircleHelp]],
  citizen: [['/my-reports', 'nav.mine', ClipboardList], ['/community', 'nav.community', MapPinned], ['/scorecard', 'nav.scorecard', Trophy], ['/how-it-works', 'nav.guide', BookOpen]],
  officer: [['/queue', 'nav.myqueue', ListChecks], ['/analytics', 'nav.analytics', BarChart3], ['/scorecard', 'nav.scorecard', Trophy]],
  admin: [['/queue', 'nav.queue', ListChecks], ['/analytics', 'nav.analytics', BarChart3], ['/scorecard', 'nav.scorecard', Trophy]],
};
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

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
        <span className="hidden text-left text-xs leading-tight 2xl:block">
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


// Sliding underline that follows the active link (or the hovered one) across the desktop nav.
function useNavIndicator(navRef, pathname) {
  const [box, setBox] = useState(null);
  const measure = useCallback((el) => {
    const nav = navRef.current;
    if (!nav || !el) { setBox(null); return; }
    const a = el.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    setBox({ left: a.left - n.left, width: a.width });
  }, [navRef]);
  const reset = useCallback(() => measure(navRef.current?.querySelector('[aria-current="page"]')), [measure, navRef]);
  useEffect(() => {
    reset();
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, [pathname, reset]);
  return { box, measure, reset };
}

function Drawer({ open, onClose, user, links, unread, onSignOut }) {
  const { t, lang, toggleLang, lite, toggleLite } = usePrefs();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open, onClose]);
  const cls = ({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-brand-50 text-brand-800 dark:bg-brand-800/30 dark:text-brand-100' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-ink-800'}`;
  return (
    <div className={`fixed inset-0 z-[2500] lg:hidden ${open ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-ink-950/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} aria-hidden />
      <nav aria-label="Mobile" aria-hidden={!open} inert={!open}
        className={`absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-[var(--ease-out-expo)] dark:bg-ink-950 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-ink-800">
          <span className="text-sm font-semibold text-slate-500">{t('hdr.menu')}</span>
          <button type="button" className="btn-ghost h-10 w-10 rounded-full p-0" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" aria-hidden /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {user && (
            <Link to="/profile" className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-50 to-white p-3 ring-1 ring-brand-100 dark:from-brand-800/30 dark:to-ink-900 dark:ring-ink-700">
              <Avatar name={user.name} />
              <span className="min-w-0 text-sm"><span className="block truncate font-semibold">{user.name}</span><span className="text-xs capitalize text-slate-500 dark:text-slate-400">{t('nav.profile')} · {user.role}</span></span>
            </Link>
          )}
          {(!user || user.role === 'citizen') && (
            <Link to="/report" className="btn-primary mb-4 w-full"><Plus className="h-4 w-4" aria-hidden /> {t('nav.report')}</Link>
          )}
          <div className="flex flex-col gap-0.5">
            {links.map(([to, key, Icon]) => <NavLink key={to} to={to} className={cls}><Icon className="h-[18px] w-[18px] opacity-70" aria-hidden />{t(key)}</NavLink>)}
            {user && (
              <NavLink to="/notifications" className={cls}>
                <Bell className="h-[18px] w-[18px] opacity-70" aria-hidden />{t('nav.notifications')}
                {unread > 0 && <span className="ml-auto rounded-full bg-red-600 px-2 text-[11px] font-bold leading-5 text-white">{unread}</span>}
              </NavLink>
            )}
          </div>
          <p className="mb-2 mt-6 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('hdr.settings')}</p>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-ink-800 dark:border-ink-800">
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">{t('hdr.language')}
              <button type="button" onClick={toggleLang} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-ink-800">{lang === 'en' ? 'English → हिंदी' : 'हिंदी → English'}</button>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">{t('hdr.lite')}
              <button type="button" role="switch" aria-checked={lite} onClick={toggleLite} aria-label={t('hdr.lite')}
                className={`relative h-6 w-11 rounded-full transition-colors ${lite ? 'bg-brand-600' : 'bg-slate-300 dark:bg-ink-700'}`}>
                <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${lite ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 text-sm">{t('hdr.theme')}<ThemeToggle /></div>
          </div>
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-ink-800">
          {user ? (
            <button type="button" className="btn-secondary w-full" onClick={onSignOut}><LogOut className="h-4 w-4" aria-hidden /> {t('nav.signout')}</button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link to="/login" className="btn-secondary">{t('nav.signin')}</Link>
              <Link to="/register" className="btn-primary">{t('nav.start')}</Link>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const { t, lang, toggleLang, lite, toggleLite } = usePrefs();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useNotifications(user);
  const links = NAV[user?.role || 'guest'];
  const navRef = useRef(null);
  const { box, measure, reset } = useNavIndicator(navRef, location.pathname);
  const closeDrawer = useCallback(() => setOpen(false), []);

  useEffect(() => { setOpen(false); setHidden(false); }, [location.pathname]);

  // Elevate after scrolling, tuck away while scrolling down a long page, return on scroll up; show reading progress.
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScrolled(y > 8);
        setProgress(max > 0 ? Math.min(1, y / max) : 0);
        if (Math.abs(y - last) > 6) { setHidden(y > last && y > 240); last = y; }
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, []);

  // Ctrl/⌘ + K or "/" opens the command palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      const el = document.activeElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(el?.tagName) && !el?.isContentEditable) { e.preventDefault(); setPalette(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const linkCls = ({ isActive }) => `relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-brand-800 dark:text-brand-100' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`;
  const signOut = async () => { setOpen(false); await logout(); navigate('/'); };
  const showReport = !user || user.role === 'citizen';

  return (
    <>
      <header className={`sticky top-0 z-[1000] border-b backdrop-blur-xl transition-[translate,background-color,border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)] ${hidden && !open && !palette ? '-translate-y-full' : 'translate-y-0'} ${scrolled
        ? 'border-slate-200/80 bg-white/80 shadow-[0_8px_24px_-16px_rgb(15_23_42/0.35)] dark:border-slate-800 dark:bg-ink-950/80'
        : 'border-transparent bg-slate-50/70 dark:bg-ink-950/70'}`}>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded focus:bg-brand-700 focus:px-3 focus:py-1 focus:text-white">Skip to content</a>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5 font-bold tracking-tight" aria-label="NagriVanta home">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-[0_6px_14px_-6px_rgb(15_118_110/0.8)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
              <MapPin className="h-5 w-5" aria-hidden />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-ink-950" aria-hidden />
            </span>
            <span className="leading-none">
              <span className="block text-lg">Nagri<span className="text-brand-700 dark:text-brand-500">Vanta</span></span>
              <span className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:block dark:text-slate-400">Civic issues, resolved</span>
            </span>
          </Link>

          <nav ref={navRef} aria-label="Main" className="relative ml-6 hidden items-center gap-0.5 lg:flex" onMouseLeave={reset}>
            {links.map(([to, key]) => <NavLink key={to} to={to} className={linkCls} onMouseEnter={(e) => measure(e.currentTarget)} onFocus={(e) => measure(e.currentTarget)} onBlur={reset}>{t(key)}</NavLink>)}
            {box && <span aria-hidden className="pointer-events-none absolute -bottom-[13px] h-0.5 rounded-full bg-brand-600 transition-all duration-300 ease-[var(--ease-out-expo)] dark:bg-brand-500" style={{ left: box.left + 12, width: Math.max(0, box.width - 24) }} />}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setPalette(true)} aria-label={t('hdr.search')} aria-keyshortcuts="Control+K Meta+K"
              className="mr-1 hidden h-10 items-center gap-2 rounded-full border border-slate-200 bg-white/70 pl-3 pr-1.5 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-700 md:flex dark:border-ink-700 dark:bg-ink-900/70 dark:text-slate-400 dark:hover:text-slate-200">
              <Search className="h-4 w-4" aria-hidden /><span className="hidden 2xl:inline">{t('hdr.search')}</span>
              <kbd className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-sans text-[11px] font-semibold dark:border-ink-700 dark:bg-ink-800">{IS_MAC ? '⌘' : 'Ctrl'} K</kbd>
            </button>
            <button type="button" onClick={() => setPalette(true)} className="btn-ghost h-10 w-10 rounded-full p-0 md:hidden" aria-label={t('hdr.search')}><Search className="h-5 w-5" aria-hidden /></button>
            <button type="button" onClick={toggleLang} className="btn-ghost hidden h-10 rounded-full px-3 text-xs font-bold sm:flex" aria-label={lang === 'en' ? 'हिंदी में देखें' : 'View in English'} title={lang === 'en' ? 'हिंदी' : 'English'}>
              {lang === 'en' ? 'हिं' : 'EN'}
            </button>
            <button type="button" onClick={toggleLite} aria-pressed={lite} title={t('lite.hint')} aria-label={t('lite.hint')}
              className={`btn-ghost hidden h-10 w-10 rounded-full p-0 sm:flex ${lite ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : ''}`}>
              <Feather className="h-5 w-5" aria-hidden />
            </button>
            <ThemeToggle />
            {user && (
              <Link to="/notifications" className="btn-ghost relative h-10 w-10 rounded-full p-0" aria-label={`Notifications, ${unread} unread`}
                onClick={() => window.Notification?.permission === 'default' && window.Notification.requestPermission()}>
                <Bell className={`h-5 w-5 ${unread ? 'animate-[ring_1.2s_ease-in-out_0.6s_1]' : ''}`} style={{ transformOrigin: '50% 10%' }} aria-hidden />
                {unread > 0 && <span key={unread} className="absolute right-1 top-1 min-w-4 animate-pop rounded-full bg-red-600 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white dark:ring-ink-950">{unread > 9 ? '9+' : unread}</span>}
              </Link>
            )}
            {showReport && (
              <Link to="/report" className="btn-primary ml-1 hidden h-10 whitespace-nowrap rounded-full px-4 lg:flex"><Plus className="h-4 w-4" aria-hidden />{t('nav.report')}</Link>
            )}
            {user ? (
              <div className="ml-1 hidden lg:block"><UserMenu user={user} onSignOut={signOut} /></div>
            ) : (
              <Link to="/login" className="btn-ghost ml-1 hidden lg:flex">{t('nav.signin')}</Link>
            )}
            <button type="button" className="btn-ghost h-10 w-10 rounded-full p-0 lg:hidden" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-brand-500 to-amber-400 transition-opacity duration-300" style={{ transform: `scaleX(${progress})`, opacity: progress > 0.01 ? 1 : 0 }} />
      </header>
      <Drawer open={open} onClose={closeDrawer} user={user} links={links} unread={unread} onSignOut={signOut} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </>
  );
}
