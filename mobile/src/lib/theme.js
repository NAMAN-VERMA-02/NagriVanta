import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

const palettes = {
  light: { bg: '#f8fafc', card: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0', brand: '#0f766e', brandText: '#ffffff', input: '#ffffff', danger: '#dc2626', soft: '#effcf9' },
  dark: { bg: '#0b1220', card: '#111a2e', text: '#f1f5f9', muted: '#94a3b8', border: '#1f2a44', brand: '#14b8a6', brandText: '#0b1220', input: '#1b2640', danger: '#f87171', soft: '#11393a' },
};

export const STATUS_COLOR = {
  submitted: '#64748b', under_review: '#0284c7', needs_info: '#d97706', assigned: '#4f46e5', in_progress: '#7c3aed',
  blocked: '#ea580c', resolved: '#059669', reopened: '#e11d48', rejected: '#dc2626', closed: '#0d9488',
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setMode] = useState(null); // null = follow system until the user toggles

  useEffect(() => { AsyncStorage.getItem('theme').then((t) => t && setMode(t)); }, []);

  const scheme = mode || (system === 'dark' ? 'dark' : 'light');
  const toggle = () => {
    const next = scheme === 'dark' ? 'light' : 'dark';
    setMode(next);
    AsyncStorage.setItem('theme', next);
  };
  return <ThemeContext.Provider value={{ scheme, c: palettes[scheme], toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
