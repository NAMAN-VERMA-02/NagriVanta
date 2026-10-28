import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { usePrefs } from '../lib/prefs';
import { STATUS_COLOR, useTheme } from '../lib/theme';

export const STATUS_LABEL = {
  submitted: 'Submitted', under_review: 'Under review', needs_info: 'Needs info', assigned: 'Assigned', in_progress: 'In progress',
  blocked: 'Blocked', resolved: 'Resolved', reopened: 'Reopened', rejected: 'Rejected', closed: 'Closed',
};

// Header: brand, nav and ONE button that switches light/dark.
export function AppHeader() {
  const { c, scheme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { t, lang, toggleLang } = usePrefs();
  const path = usePathname();
  const links = user?.role === 'citizen'
    ? [['/reports', t('myReports')], ['/report', t('report')], ['/community', t('nearby')], ['/chat', t('chat')], ['/profile', t('profile')]]
    : user ? [['/queue', t('queue')], ['/chat', t('chat')], ['/profile', t('profile')]] : [['/chat', t('chat')]];
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: c.card, borderBottomWidth: 1, borderColor: c.border }}>
      <View style={s.headerRow}>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="link" accessibilityLabel="NagriVanta home" style={s.brand}>
          <View style={[s.logo, { backgroundColor: c.brand }]}><Text style={{ color: c.brandText, fontWeight: '800' }}>N</Text></View>
          <Text style={[s.brandText, { color: c.text }]}>Nagri<Text style={{ color: c.brand }}>Vanta</Text></Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={toggleLang} style={[s.iconBtn, { borderColor: c.border }]} accessibilityRole="button" accessibilityLabel={lang === 'en' ? 'हिंदी में देखें' : 'View in English'}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{lang === 'en' ? 'हिं' : 'EN'}</Text>
          </Pressable>
          <Pressable onPress={toggle} style={[s.iconBtn, { borderColor: c.border }]} accessibilityRole="button" accessibilityLabel={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Ionicons name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={scheme === 'dark' ? '#fcd34d' : c.text} />
          </Pressable>
          {user && (
            <Pressable onPress={async () => { await logout(); router.replace('/'); }} style={[s.iconBtn, { borderColor: c.border }]} accessibilityRole="button" accessibilityLabel="Sign out">
              <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{t('signOut')}</Text>
            </Pressable>
          )}
        </View>
      </View>
      {links.length > 0 && (
        <View style={s.nav}>
          {links.map(([href, label]) => {
            const active = path === href;
            return (
              <Pressable key={href} onPress={() => router.navigate(href)} style={[s.navItem, active && { backgroundColor: c.soft }]} accessibilityRole="link">
                <Text style={{ color: active ? c.brand : c.muted, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

export function AppFooter() {
  const { c } = useTheme();
  return (
    <View style={[s.footer, { borderColor: c.border }]}>
      <Text style={{ color: c.text, fontWeight: '700' }}>NagriVanta</Text>
      <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
        Independent pilot project, not an official government system. In an emergency call 112.
      </Text>
      <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>© {new Date().getFullYear()} NagriVanta · Map data © OpenStreetMap contributors</Text>
    </View>
  );
}

// Every screen scrolls and ends with the footer.
export function Screen({ children, refreshControl }) {
  const { c } = useTheme();
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, flexGrow: 1 }} refreshControl={refreshControl} keyboardShouldPersistTaps="handled">
      <View style={{ flex: 1, gap: 12 }}>{children}</View>
      <AppFooter />
    </ScrollView>
  );
}

export function Title({ children, sub }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={{ color: c.text, fontSize: 24, fontWeight: '800' }} accessibilityRole="header">{children}</Text>
      {sub && <Text style={{ color: c.muted, marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}

export function Card({ children, style }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 }, style]}>{children}</View>;
}

export function T({ children, muted, bold, size = 15, style }) {
  const { c } = useTheme();
  return <Text style={[{ color: muted ? c.muted : c.text, fontWeight: bold ? '700' : '400', fontSize: size }, style]}>{children}</Text>;
}

export function Field({ label, ...props }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} {...props}
        style={[{ borderWidth: 1, borderColor: c.border, backgroundColor: c.input, color: c.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 }, props.multiline && { minHeight: 90, textAlignVertical: 'top' }]} />
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled }) {
  const { c } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={({ pressed }) => [{ borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1,
        backgroundColor: primary ? c.brand : c.card, borderColor: primary ? c.brand : c.border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      <Text style={{ color: primary ? c.brandText : c.text, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}
      style={{ borderWidth: 1, borderColor: selected ? c.brand : c.border, backgroundColor: selected ? c.soft : c.card, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text style={{ color: selected ? c.brand : c.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function StatusPill({ status }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: STATUS_COLOR[status] || '#64748b', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{STATUS_LABEL[status] || status}</Text>
    </View>
  );
}

export function ErrorText({ error }) {
  const { c } = useTheme();
  if (!error) return null;
  return <Text accessibilityLiveRegion="polite" style={{ color: c.danger, fontWeight: '600' }}>{error.message || String(error)}</Text>;
}

export function Loading() {
  const { c } = useTheme();
  return <ActivityIndicator style={{ marginTop: 40 }} color={c.brand} accessibilityLabel="Loading" />;
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 18, fontWeight: '800' },
  iconBtn: { minWidth: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  navItem: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  footer: { borderTopWidth: 1, marginTop: 24, paddingTop: 16 },
});
