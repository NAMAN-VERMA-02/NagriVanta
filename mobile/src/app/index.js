import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Button, Card, ErrorText, Field, Loading, Screen, T, Title } from '../components/ui';
import { useAuth } from '../lib/auth';

// Signed-out users see sign in / register; signed-in users go to their home screen.
export default function Index() {
  const { user, loading, login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Screen><Loading /></Screen>;
  if (user) return <Redirect href={user.role === 'citizen' ? '/reports' : '/queue'} />;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      if (mode === 'login') await login({ email: form.email.trim(), password: form.password });
      else await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Title sub="Report civic issues and follow them to resolution.">{mode === 'login' ? 'Sign in' : 'Create account'}</Title>
      <Card>
        {mode === 'register' && <Field label="Full name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} autoComplete="name" />}
        <Field label="Email" value={form.email} onChangeText={(email) => setForm({ ...form, email })} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={form.password} onChangeText={(password) => setForm({ ...form, password })} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        <ErrorText error={error} />
        <Button title={busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} disabled={busy} />
        <Button variant="secondary" title={mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }} />
      </Card>
      <Card>
        <T bold size={13}>Demo accounts (after seeding the server)</T>
        <T muted size={13}>citizen1@nagrivanta.local · pwd.officer@nagrivanta.local{'\n'}Password: Demo@12345</T>
        <T muted size={12}>Admin triage and analytics are on the web app.</T>
      </Card>
    </Screen>
  );
}
