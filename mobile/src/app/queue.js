import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { Card, Chip, ErrorText, Loading, Screen, StatusPill, T, Title } from '../components/ui';
import { api } from '../lib/api';

const FILTERS = [['', 'All'], ['assigned', 'Assigned'], ['in_progress', 'In progress'], ['blocked', 'Blocked'], ['reopened', 'Reopened']];

export default function Queue() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api('/complaints', { query: { status } }).then(({ data }) => { setItems(data); setError(null); }).catch(setError), [status]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Title sub="Cases assigned to you or your department.">My queue</Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {FILTERS.map(([v, l]) => <Chip key={v} label={l} selected={status === v} onPress={() => { setItems(null); setStatus(v); }} />)}
      </View>
      <ErrorText error={error} />
      {!items && !error && <Loading />}
      {items?.length === 0 && <Card><T>No cases here.</T></Card>}
      {items?.map((c) => {
        const overdue = c.sla?.dueAt && new Date(c.sla.dueAt) < new Date() && !['resolved', 'closed', 'rejected'].includes(c.status);
        return (
          <Pressable key={c._id} onPress={() => router.push(`/complaint/${c._id}`)} accessibilityRole="link">
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StatusPill status={c.status} />
                <T bold size={12} style={{ color: c.priority === 'critical' || c.priority === 'high' ? '#ea580c' : undefined }}>{c.priority.toUpperCase()}</T>
              </View>
              <T bold>{c.title}</T>
              <T muted size={12}>{c.referenceId} · {c.ward || 'No ward'}</T>
              {overdue && <T bold size={12} style={{ color: '#dc2626' }}>Overdue since {new Date(c.sla.dueAt).toLocaleDateString()}</T>}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
