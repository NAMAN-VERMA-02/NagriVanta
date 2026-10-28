import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Button, Card, Chip, ErrorText, Field, Screen, StatusPill, T, Title } from '../components/ui';
import { api, appendImage } from '../lib/api';

const CATEGORIES = [['auto', 'Let AI suggest'], ['road', 'Road'], ['garbage', 'Garbage'], ['water', 'Water'], ['streetlight', 'Streetlight'], ['drainage', 'Drainage'], ['other', 'Other']];
const WARDS = ['Indirapuram', 'Vaishali', 'Raj Nagar Extension', 'Kavi Nagar', 'Sector 62 Noida', 'Vasundhara', 'Other'];

export default function Report() {
  const [form, setForm] = useState({ title: '', description: '', category: 'auto', ward: '', address: '' });
  const [loc, setLoc] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [dups, setDups] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);

  const locate = async () => {
    setLocBusy(true); setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission denied. Enable it in settings to pin the issue.');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
    } catch (e) { setError(e); } finally { setLocBusy(false); }
  };

  useEffect(() => { locate(); }, []);

  // duplicate hints once we have location and some text
  useEffect(() => {
    if (!loc || form.title.length + form.description.length < 8) { setDups([]); return undefined; }
    const t = setTimeout(() => {
      api('/complaints/nearby', { query: { lat: loc.lat, lng: loc.lng, text: `${form.title} ${form.description}`, category: form.category } })
        .then(({ data }) => setDups(data)).catch(() => setDups([]));
    }, 700);
    return () => clearTimeout(t);
  }, [loc, form.title, form.description, form.category]);

  const pick = async (camera) => {
    const opts = { mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: !camera, selectionLimit: 3 };
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setError(new Error('Camera permission denied.')); return; }
    }
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) setPhotos([...photos, ...res.assets].slice(0, 3));
  };

  const submit = async () => {
    if (!loc) { setError(new Error('Location is required. Tap "Use my location".')); return; }
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      fd.append('lat', String(loc.lat));
      fd.append('lng', String(loc.lng));
      fd.append('source', 'mobile');
      for (const [i, p] of photos.entries()) await appendImage(fd, 'images', p, i);
      const { data } = await api('/complaints', { method: 'POST', body: fd });
      router.replace(`/complaint/${data._id}`);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Title sub="A clear photo and exact location help the right team.">Report an issue</Title>
      <Card>
        <Field label="Short title" value={form.title} maxLength={120} placeholder="Deep pothole outside metro gate" onChangeText={(title) => setForm({ ...form, title })} />
        <Field label="What is the problem?" value={form.description} maxLength={2000} multiline placeholder="English or Hindi is fine" onChangeText={(description) => setForm({ ...form, description })} />
        <T bold size={14}>Category</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
          {CATEGORIES.map(([v, l]) => <Chip key={v} label={l} selected={form.category === v} onPress={() => setForm({ ...form, category: v })} />)}
        </View>
        <T bold size={14}>Ward</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
          {WARDS.map((w) => <Chip key={w} label={w} selected={form.ward === w} onPress={() => setForm({ ...form, ward: w })} />)}
        </View>
        <Field label="Landmark (optional)" value={form.address} maxLength={200} onChangeText={(address) => setForm({ ...form, address })} />
      </Card>

      <Card>
        <T bold size={14}>Location</T>
        <T muted size={13}>{loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)} (±${Math.round(loc.accuracy || 0)} m)` : 'Not set yet'}</T>
        <Button variant="secondary" title={locBusy ? 'Locating…' : 'Use my location'} onPress={locate} disabled={locBusy} />
      </Card>

      <Card>
        <T bold size={14}>Photos ({photos.length}/3)</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {photos.map((p) => <Image key={p.uri} source={{ uri: p.uri }} style={{ width: 80, height: 80, borderRadius: 8 }} accessibilityLabel="Selected photo" />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button variant="secondary" title="Camera" onPress={() => pick(true)} disabled={photos.length >= 3} /></View>
          <View style={{ flex: 1 }}><Button variant="secondary" title="Gallery" onPress={() => pick(false)} disabled={photos.length >= 3} /></View>
        </View>
      </Card>

      {dups.length > 0 && (
        <Card>
          <T bold>Possibly already reported nearby</T>
          {dups.map((d) => (
            <View key={d.id} style={{ gap: 2 }}>
              <StatusPill status={d.status} />
              <T size={14}>{d.title}</T>
              <T muted size={12}>{d.referenceId} · {d.signals.join(' · ')}</T>
            </View>
          ))}
          <T muted size={12}>You can still submit; staff decide if it is the same issue.</T>
        </Card>
      )}

      <ErrorText error={error} />
      <Button title={busy ? 'Submitting…' : 'Submit report'} onPress={submit} disabled={busy} />
    </Screen>
  );
}
