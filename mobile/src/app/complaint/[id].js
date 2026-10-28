import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Button, Card, Chip, ErrorText, Field, Loading, Screen, STATUS_LABEL, StatusPill, T, Title } from '../../components/ui';
import { api, appendImage, imageUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';

const ACTION = { created: 'Report submitted', status_change: 'Status changed', assigned: 'Assigned', note: 'Update', feedback: 'Feedback', reopened: 'Reopened', escalated: 'SLA escalation', reviewed: 'Reviewed', ai_analysis: 'AI triage' };

function OfficerActions({ d, reload }) {
  const c = d.complaint;
  const [to, setTo] = useState(d.allowedTransitions[0]);
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!d.allowedTransitions.length) return null;

  const addEvidence = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const res = perm.granted
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled) setEvidence([...evidence, ...res.assets].slice(0, 3));
  };

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('to', to);
      if (note) fd.append('note', note);
      for (const [i, p] of evidence.entries()) await appendImage(fd, 'evidence', p, i);
      await api(`/complaints/${c._id}/status`, { method: 'PATCH', body: fd });
      setNote(''); setEvidence([]);
      await reload();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <Card>
      <T bold>Update status</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {d.allowedTransitions.map((t) => <Chip key={t} label={STATUS_LABEL[t]} selected={to === t} onPress={() => setTo(t)} />)}
      </View>
      <Field label={to === 'resolved' ? 'Resolution note (required)' : 'Note / reason'} value={note} onChangeText={setNote} multiline />
      {to === 'resolved' && (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>{evidence.map((p) => <Image key={p.uri} source={{ uri: p.uri }} style={{ width: 70, height: 70, borderRadius: 8 }} />)}</View>
          <Button variant="secondary" title="Add after-photo (required)" onPress={addEvidence} />
        </>
      )}
      <ErrorText error={error} />
      <Button title={busy ? 'Saving…' : 'Update'} onPress={submit} disabled={busy || !to} />
    </Card>
  );
}

function CitizenActions({ d, reload }) {
  const c = d.complaint;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const run = async (fn) => { setError(null); try { await fn(); await reload(); } catch (e) { setError(e); } };

  return (
    <>
      {d.feedback && <Card><T bold>Your rating: {'★'.repeat(d.feedback.rating)}</T>{d.feedback.comment && <T>{d.feedback.comment}</T>}</Card>}
      {d.canFeedback && (
        <Card>
          <T bold>Was it fixed?</T>
          <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="radio" accessibilityState={{ selected: rating === n }} accessibilityLabel={`${n} star`} style={{ padding: 4 }}>
                <T size={28} style={{ color: n <= rating ? '#f59e0b' : '#94a3b8' }}>★</T>
              </Pressable>
            ))}
          </View>
          <Field label="Comment (optional)" value={comment} onChangeText={setComment} maxLength={500} />
          <Button title="Submit feedback" disabled={!rating} onPress={() => run(() => api(`/complaints/${c._id}/feedback`, { method: 'POST', body: { rating, comment: comment || undefined } }))} />
        </Card>
      )}
      {d.canReopen && (
        <Card>
          <T bold>Problem still there?</T>
          <Field label="What is still wrong?" value={reason} onChangeText={setReason} multiline />
          <Button variant="secondary" title="Reopen case" disabled={reason.trim().length < 5} onPress={() => run(() => api(`/complaints/${c._id}/reopen`, { method: 'POST', body: { reason } }))} />
        </Card>
      )}
      <ErrorText error={error} />
    </>
  );
}

export default function ComplaintDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { c: colors } = useTheme();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api(`/complaints/${id}`).then(({ data }) => setD(data)).catch(setError), [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <Screen><ErrorText error={error} /></Screen>;
  if (!d) return <Screen><Loading /></Screen>;
  const c = d.complaint;
  const [lng, lat] = c.location.coordinates;
  const ai = c.aiAnalysis;

  return (
    <Screen>
      <T muted size={12}>{c.referenceId}</T>
      <Title>{c.title}</Title>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <StatusPill status={c.status} />
        <T muted size={13}>{c.category} · {c.priority} priority</T>
      </View>
      {c.sla?.dueAt && !['resolved', 'closed', 'rejected'].includes(c.status) && (
        <T bold size={13} style={{ color: new Date(c.sla.dueAt) < new Date() ? colors.danger : colors.muted }}>Target date: {new Date(c.sla.dueAt).toLocaleString()}</T>
      )}

      <Card>
        <T>{c.description}</T>
        {c.images?.length > 0 && <View style={{ flexDirection: 'row', gap: 8 }}>{c.images.map((src) => <Image key={src} source={{ uri: imageUrl(src) }} style={{ width: 96, height: 96, borderRadius: 8 }} accessibilityLabel="Reported issue photo" />)}</View>}
        <Button variant="secondary" title="Open location in maps" onPress={() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`)} />
      </Card>

      {ai && ai.status !== 'pending' && (
        <Card>
          <T bold size={13} style={{ color: '#b45309' }}>{ai.status === 'done' ? 'AI suggestion' : 'Rule-based suggestion'} · awaiting staff review</T>
          {ai.summary && <T style={{ fontStyle: 'italic' }}>“{ai.summary}”</T>}
          <T muted size={13}>Category {ai.category} · priority {ai.priority}{ai.confidence != null ? ` · ${Math.round(ai.confidence * 100)}%` : ''}</T>
        </Card>
      )}

      {c.resolution?.note && (
        <Card>
          <T bold>Resolution</T>
          <T>{c.resolution.note}</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>{c.resolution.evidence?.map((e) => <Image key={e} source={{ uri: imageUrl(e) }} style={{ width: 96, height: 96, borderRadius: 8 }} accessibilityLabel="After-fix photo" />)}</View>
        </Card>
      )}

      {user.role === 'citizen' ? <CitizenActions d={d} reload={load} /> : <OfficerActions d={d} reload={load} />}

      <Card>
        <T bold>Timeline</T>
        {d.history.map((h) => (
          <View key={h._id} style={{ borderLeftWidth: 2, borderColor: colors.brand, paddingLeft: 10, gap: 2 }}>
            <T bold size={14}>{ACTION[h.action] || h.action}{h.toStatus && h.fromStatus ? ` → ${STATUS_LABEL[h.toStatus]}` : ''}</T>
            <T muted size={12}>{new Date(h.createdAt).toLocaleString()} · {h.actorId?.name || 'System'}</T>
            {h.note && <T size={13}>{h.note}</T>}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
