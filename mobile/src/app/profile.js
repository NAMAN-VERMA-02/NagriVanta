import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { Button, Card, ErrorText, Field, Loading, Screen, StatusPill, T } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePrefs } from '../lib/prefs';
import { useTheme } from '../lib/theme';

const BADGE_ICON = { first: 'flag', photo: 'camera', fixed: 'checkmark-circle', voice: 'thumbs-up', rater: 'star', explorer: 'compass', trusted: 'shield-checkmark', regular: 'repeat' };

// Same data as the website profile: details, civic level, stats, badges, activity and settings.
export default function Profile() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { lang, toggleLang } = usePrefs();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api('/profile').then(({ data }) => { setP(data); setName(data.user.name); setError(null); }).catch(setError), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!p) return <Screen>{error ? <ErrorText error={error} /> : <Loading />}</Screen>;
  const s = p.stats;
  const citizen = user.role === 'citizen';
  const initials = p.user.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  const stats = citizen
    ? [['Reports', s.reports], ['Resolved', `${s.resolutionRate}%`], ['Support', s.supportReceived], ['Votes given', s.votesGiven]]
    : [['Active', s.active], ['Overdue', s.overdue], ['Resolved', s.resolvedByMe], ['Rating', s.avgCitizenRating ?? '—']];

  const save = async () => {
    setMsg(''); setError(null);
    try { await api('/profile', { method: 'PATCH', body: { name } }); setMsg('Saved'); load(); } catch (e) { setError(e); }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={{ backgroundColor: c.brand, borderRadius: 20, padding: 18, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }} numberOfLines={1}>{p.user.name}</Text>
            <Text style={{ color: '#ccfbf1', fontSize: 13 }} numberOfLines={1}>{user.role}{user.city ? ` · ${user.city}` : ''} · {p.user.email}</Text>
          </View>
        </View>
        {p.level && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: 12, gap: 6 }}>
            <Text style={{ color: '#ccfbf1', fontSize: 12 }}>Civic level</Text>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{p.level.name} · {p.level.points} pts</Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: '#fff', width: `${Math.round(p.level.progress * 100)}%` }} />
            </View>
            <Text style={{ color: '#ccfbf1', fontSize: 12 }}>{p.level.nextName ? `${p.level.nextAt - p.level.points} points to ${p.level.nextName}` : 'Highest level reached'}</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {stats.map(([l, v]) => (
          <Card key={l} style={{ flexBasis: '47%', flexGrow: 1, gap: 2 }}>
            <T muted size={12}>{l}</T>
            <T bold size={22}>{String(v)}</T>
          </Card>
        ))}
      </View>

      {citizen && (
        <Card>
          <T bold>Badges ({p.badges.filter((b) => b.earned).length}/{p.badges.length})</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {p.badges.map((b) => (
              <View key={b.id} style={{ width: '46%', flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={`${b.name}${b.earned ? ', earned' : `, locked: ${b.hint}`}`}>
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: b.earned ? c.brand : c.border }}>
                  <Ionicons name={b.earned ? BADGE_ICON[b.id] || 'ribbon' : 'lock-closed'} size={16} color={b.earned ? c.brandText : c.muted} />
                </View>
                <T size={13} style={{ flex: 1, opacity: b.earned ? 1 : 0.6 }}>{b.name}</T>
              </View>
            ))}
          </View>
        </Card>
      )}

      <Card>
        <T bold>Recent activity</T>
        {p.activity.slice(0, 8).map((a, i) => (
          <Pressable key={i} onPress={() => router.push(`/complaint/${a.complaint.id}`)} accessibilityRole="link" style={{ gap: 2, paddingVertical: 4 }}>
            <T size={14}><Text style={{ fontWeight: '700' }}>{a.action.replace('_', ' ')}</Text> · {a.complaint.title}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <StatusPill status={a.complaint.status} />
              <T muted size={12}>{new Date(a.at).toLocaleDateString()}</T>
            </View>
          </Pressable>
        ))}
        {p.activity.length === 0 && <T muted>No activity yet.</T>}
      </Card>

      <Card>
        <T bold>Settings</T>
        <Field label="Full name" value={name} onChangeText={setName} maxLength={80} />
        <Button title="Save name" onPress={save} disabled={name.trim().length < 2} />
        {msg ? <T style={{ color: c.brand }}>{msg}</T> : null}
        <Button variant="secondary" title={lang === 'en' ? 'हिंदी में बदलें' : 'Switch to English'} onPress={toggleLang} />
        <ErrorText error={error} />
      </Card>
    </Screen>
  );
}
