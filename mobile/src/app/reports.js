import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { Button, Card, ErrorText, Loading, Screen, StatusPill, T, Title } from '../components/ui';
import { api } from '../lib/api';

export default function MyReports() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api('/complaints/mine').then(({ data }) => { setItems(data); setError(null); }).catch(setError), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Title sub="Pull down to refresh.">My reports</Title>
      <Button title="+ Report a new issue" onPress={() => router.navigate('/report')} />
      <ErrorText error={error} />
      {!items && !error && <Loading />}
      {items?.length === 0 && <Card><T>No reports yet. Spotted a pothole or blocked drain? Report it.</T></Card>}
      {items?.map((c) => (
        <Pressable key={c._id} onPress={() => router.push(`/complaint/${c._id}`)} accessibilityRole="link">
          <Card>
            <StatusPill status={c.status} />
            <T bold>{c.title}</T>
            <T muted size={12}>{c.referenceId} · {new Date(c.createdAt).toLocaleDateString()} · {c.category}</T>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
