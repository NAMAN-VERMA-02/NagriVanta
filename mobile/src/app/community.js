import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, RefreshControl, View } from 'react-native';
import { Button, Card, ErrorText, Loading, Screen, StatusPill, T, Title } from '../components/ui';
import { api, imageUrl } from '../lib/api';
import { usePrefs } from '../lib/prefs';

// Nearby issues with one "me too" vote per citizen; votes raise the case's priority.
export default function Community() {
  const { t } = usePrefs();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let near;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const p = await Location.getLastKnownPositionAsync();
        if (p) near = `${p.coords.latitude.toFixed(4)},${p.coords.longitude.toFixed(4)}`;
      }
    } catch { /* fall back to all issues */ }
    return api('/complaints', { query: { near, sort: 'top', limit: 30 } }).then(({ data }) => { setItems(data); setError(null); }).catch(setError);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const vote = async (c) => {
    try {
      const { data } = await api(`/complaints/${c.id}/upvote`, { method: c.hasVoted ? 'DELETE' : 'POST' });
      setItems((list) => list.map((x) => (x.id === c.id ? { ...x, upvotes: data.upvotes, hasVoted: data.hasVoted } : x)));
    } catch (e) { setError(e); }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Title sub={t('nearbySub')}>{t('nearbyTitle')}</Title>
      <ErrorText error={error} />
      {!items && !error && <Loading />}
      {items?.map((c) => (
        <Card key={c.id}>
          {c.image ? <Image source={{ uri: imageUrl(c.image) }} style={{ width: '100%', height: 140, borderRadius: 10 }} accessibilityLabel="Issue photo" /> : null}
          <StatusPill status={c.status} />
          <T bold>{c.title}</T>
          <T muted size={12}>{c.referenceId} · {c.ward || c.city}</T>
          <View>
            {c.isMine ? <T muted size={12}>Your report · {c.upvotes}</T>
              : <Button variant={c.hasVoted ? 'primary' : 'secondary'} title={`👍 ${t('metoo')} · ${c.upvotes}`} onPress={() => vote(c)} />}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
