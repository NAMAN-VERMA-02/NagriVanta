import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { STRINGS } from '../i18n';

const PrefsContext = createContext(null);

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

// Data-saver browsers and 2G connections start in Lite mode.
const slowConnection = () => {
  const c = navigator.connection;
  return Boolean(c && (c.saveData || ['slow-2g', '2g'].includes(c.effectiveType)));
};

export function PrefsProvider({ children }) {
  const [lang, setLang] = useState(() => read('lang') || (navigator.language?.startsWith('hi') ? 'hi' : 'en'));
  const [lite, setLite] = useState(() => (read('lite') ? read('lite') === '1' : slowConnection()));
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => { write('lang', lang); document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { write('lite', lite ? '1' : '0'); }, [lite]);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const value = useMemo(() => ({
    lang,
    lite,
    online,
    toggleLang: () => setLang((l) => (l === 'en' ? 'hi' : 'en')),
    toggleLite: () => setLite((v) => !v),
    t: (key, ...args) => {
      const s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
      return typeof s === 'function' ? s(...args) : s;
    },
  }), [lang, lite, online]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
