import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppHeader } from '../components/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import { flushOutbox, onOutboxChange, queuedCount } from '../lib/outbox';
import { PrefsProvider, usePrefs } from '../lib/prefs';
import { ThemeProvider, useTheme } from '../lib/theme';

// Sends reports saved offline whenever the app comes to the foreground while signed in.
function OutboxSync() {
  const { user } = useAuth();
  const { t } = usePrefs();
  const [n, setN] = useState(0);
  useEffect(() => {
    queuedCount().then(setN);
    const off = onOutboxChange(setN);
    if (user?.role !== 'citizen') return off;
    flushOutbox();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && flushOutbox());
    return () => { off(); sub.remove(); };
  }, [user]);
  if (!n) return null;
  return <View style={{ backgroundColor: '#fef3c7', padding: 8 }}><Text style={{ color: '#92400e', textAlign: 'center', fontWeight: '600' }}>{t('queued', n)}</Text></View>;
}

function Shell() {
  const { scheme, c } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ header: () => <><AppHeader /><OutboxSync /></>, contentStyle: { backgroundColor: c.bg } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PrefsProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </PrefsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
