import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, BarChart3, Bell, BookOpen, CircleHelp, ClipboardList, CornerDownLeft, Feather, Info, Languages, ListChecks, MapPinned, Megaphone, Moon, Search, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { useTheme } from '../context/ThemeContext';

const PAGES = [
  { to: '/report', key: 'nav.report', icon: Megaphone, roles: ['guest', 'citizen'], words: 'new complaint file submit shikayat' },
  { to: '/my-reports', key: 'nav.mine', icon: ClipboardList, roles: ['citizen'], words: 'history complaints' },
  { to: '/community', key: 'nav.community', icon: MapPinned, roles: ['citizen'], words: 'map near vote' },
  { to: '/queue', key: 'nav.queue', icon: ListChecks, roles: ['officer', 'admin'], words: 'triage cases work' },
  { to: '/analytics', key: 'nav.analytics', icon: BarChart3, roles: ['officer', 'admin'], words: 'heatmap ward stats' },
  { to: '/scorecard', key: 'nav.scorecard', icon: Trophy, words: 'ward ranking performance' },
  { to: '/track', key: 'nav.track', icon: Search, words: 'status reference' },
  { to: '/profile', key: 'nav.profile', icon: UserRound, roles: ['citizen', 'officer', 'admin'], words: 'account settings password' },
  { to: '/notifications', key: 'nav.notifications', icon: Bell, roles: ['citizen', 'officer', 'admin'], words: 'alerts updates' },
  { to: '/how-it-works', key: 'nav.guide', icon: BookOpen, words: 'help guide instructions' },
  { to: '/faq', key: 'nav.faq', icon: CircleHelp, words: 'questions help' },
  { to: '/about', key: 'nav.about', icon: Info, words: 'team mission' },
  { to: '/login', key: 'nav.signin', icon: ShieldCheck, roles: ['guest'], words: 'login account' },
];

// Ctrl/⌘ + K: jump to any page, run quick actions, or open a report by its reference ID.
export default function CommandPalette({ open, onClose }) {
  const { user } = useAuth();
  const { t, toggleLang, toggleLite, lite } = usePrefs();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const role = user?.role || 'guest';

  useEffect(() => {
    if (!open) return undefined;
    setQ(''); setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const ref = /^civ-?\w*/i.test(term) && term.length >= 6 ? q.trim().toUpperCase() : null;
    const pages = PAGES.filter((p) => !p.roles || p.roles.includes(role)).map((p) => ({ id: p.to, group: 'hdr.pages', label: t(p.key), hint: p.to, icon: p.icon, words: p.words, run: () => navigate(p.to) }));
    const actions = [
      { id: 'theme', group: 'hdr.actions', label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', icon: Moon, words: 'dark light theme', run: toggle },
      { id: 'lang', group: 'hdr.actions', label: 'हिंदी / English', icon: Languages, words: 'language hindi english bhasha', run: toggleLang },
      { id: 'lite', group: 'hdr.actions', label: `${t('hdr.lite')}: ${lite ? 'on → off' : 'off → on'}`, icon: Feather, words: 'data saver slow network lite', run: toggleLite },
    ];
    const all = [...pages, ...actions].filter((i) => !term || `${i.label} ${i.words} ${i.hint || ''}`.toLowerCase().includes(term));
    if (ref) all.unshift({ id: 'ref', group: 'hdr.actions', label: `${t('hdr.trackRef')} ${ref}`, icon: Search, run: () => navigate(`/track/${encodeURIComponent(ref)}`) });
    return all;
  }, [q, role, t, theme, lite, navigate, toggle, toggleLang, toggleLite]);

  useEffect(() => { setActive(0); }, [q]);
  if (!open) return null;

  const run = (i) => { onClose(); i.run(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % Math.max(items.length, 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + items.length) % Math.max(items.length, 1)); }
    if (e.key === 'Enter' && items[active]) { e.preventDefault(); run(items[active]); }
    if (e.key === 'Escape') onClose();
  };

  let lastGroup = null;
  return (
    <div className="fixed inset-0 z-[3000] flex items-start justify-center bg-ink-950/50 px-4 pt-[12vh] backdrop-blur-sm animate-fade" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={t('hdr.search')} className="w-full max-w-xl animate-pop overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_-20px_rgb(15_23_42/0.6)] dark:border-ink-700 dark:bg-ink-900">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-ink-700">
          <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={t('hdr.searchPh')}
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={items[active] ? `cmdk-${items[active].id}` : undefined}
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-slate-400" />
          <kbd className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500 sm:block dark:border-ink-700">Esc</kbd>
        </div>
        <ul id="cmdk-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">{t('hdr.noResults')}</li>}
          {items.map((i, idx) => {
            const head = i.group !== lastGroup ? (lastGroup = i.group) : null;
            const Icon = i.icon;
            return (
              <li key={i.id} role="presentation">
                {head && <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t(head)}</p>}
                <button id={`cmdk-${i.id}`} type="button" role="option" aria-selected={idx === active} onMouseMove={() => setActive(idx)} onClick={() => run(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${idx === active ? 'bg-brand-50 text-brand-900 dark:bg-brand-800/30 dark:text-brand-100' : 'text-slate-700 dark:text-slate-200'}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${idx === active ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500 dark:bg-ink-800 dark:text-slate-300'}`}><Icon className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1 truncate font-medium">{i.label}</span>
                  {i.hint && <span className="hidden font-mono text-xs text-slate-400 sm:block">{i.hint}</span>}
                  {idx === active ? <CornerDownLeft className="h-4 w-4 text-brand-600" aria-hidden /> : <ArrowRight className="h-4 w-4 text-transparent" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500 dark:border-ink-700">
          <span><kbd className="font-sans">↑↓</kbd> navigate</span><span><kbd className="font-sans">↵</kbd> open</span><span className="ml-auto">NagriVanta</span>
        </div>
      </div>
    </div>
  );
}
