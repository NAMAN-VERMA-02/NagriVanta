import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, ErrorText, Field, Screen, T, Title } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePrefs } from '../lib/prefs';
import { useTheme } from '../lib/theme';

// Chat channel: the same AI civic assistant as the website. Voice works through the keyboard's mic.
export default function Chat() {
  const { t, lang } = usePrefs();
  const { user } = useAuth();
  const { c } = useTheme();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next); setInput(''); setBusy(true); setError(null);
    try {
      const { data } = await api('/assistant/chat', { method: 'POST', body: { messages: next.map(({ role, content }) => ({ role, content })), lang } });
      setMsgs([...next, { role: 'assistant', content: data.reply, draft: data.draft, complaintId: data.complaintId }]);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const bubble = (mine) => ({ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: mine ? c.brand : c.card, borderColor: c.border, borderWidth: mine ? 0 : 1, borderRadius: 14, padding: 10, gap: 6 });

  return (
    <Screen>
      <Title>{t('chatTitle')}</Title>
      <View style={bubble(false)}><T size={14}>{t('chatHello')}</T></View>
      {msgs.map((m, i) => (
        <View key={i} style={bubble(m.role === 'user')}>
          <T size={14} style={m.role === 'user' ? { color: c.brandText } : undefined}>{m.content}</T>
          {m.draft && (
            <Card>
              <T bold size={13}>{m.draft.title}</T>
              <T muted size={12}>{m.draft.category}</T>
              {user?.role === 'citizen' && <Button title={t('useDraft')} onPress={() => router.push({ pathname: '/report', params: { title: m.draft.title, description: m.draft.description, category: m.draft.category } })} />}
            </Card>
          )}
          {m.complaintId && <Button variant="secondary" title="Open case" onPress={() => router.push(`/complaint/${m.complaintId}`)} />}
        </View>
      ))}
      {busy && <T muted>…</T>}
      <ErrorText error={error} />
      <Field label={t('chatPh')} value={input} onChangeText={setInput} maxLength={2000} multiline onSubmitEditing={send} />
      <Button title={t('send')} onPress={send} disabled={busy || !input.trim()} />
    </Screen>
  );
}
