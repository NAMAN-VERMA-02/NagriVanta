import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Button, Card, Chip, ErrorText, Field, Screen, StatusPill, T, Title } from '../components/ui';
import { api, appendImage } from '../lib/api';
import { queueReport } from '../lib/outbox';
import { usePrefs } from '../lib/prefs';

const CATEGORIES = [['auto', 'AI ✨'], ['road', 'Road'], ['garbage', 'Garbage'], ['water', 'Water'], ['streetlight', 'Streetlight'], ['drainage', 'Drainage'], ['other', 'Other']];

export default function Report() {
  const { t } = usePrefs();
  const draft = useLocalSearchParams();
  const [form, setForm] = useState({ title: draft.title || '', description: draft.description || '', category: draft.category || 'auto', ward: '', address: '' });
  const [wards, setWards] = useState([]);
  const [loc, setLoc] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [dups, setDups] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);

  useEffect(() => { api('/cities').then(({ data }) => setWards(data.flatMap((c) => c.wards.map((w) => w.name)))).catch(() => {}); }, []);

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

  useEffect(() => {
    if (!loc || form.title.length + form.description.length < 8) { setDups([]); return undefined; }
    const tm = setTimeout(() => {
      api('/complaints/nearby', { query: { lat: loc.lat, lng: loc.lng, text: `${form.title} ${form.description}`, category: form.category } })
        .then(({ data }) => setDups(data)).catch(() => setDups([]));
    }, 700);
    return () => clearTimeout(tm);
  }, [loc, form.title, form.description, form.category]);

  // quality 0.5 keeps 3 phone photos well under the 4 MB upload limit (and is kinder on slow networks)
  const pick = async (camera) => {
    const opts = { mediaTypes: ['images'], quality: 0.5, exif: true, allowsMultipleSelection: !camera, selectionLimit: 3 };
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setError(new Error('Camera permission denied.')); return; }
    }
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    setPhotos([...photos, ...res.assets].slice(0, 3));
    const gps = res.assets.find((a) => a.exif?.GPSLatitude)?.exif;
    if (!loc && gps) {
      const sign = (v, ref) => (ref === 'S' || ref === 'W' ? -Math.abs(v) : Math.abs(v));
      setLoc({ lat: sign(gps.GPSLatitude, gps.GPSLatitudeRef), lng: sign(gps.GPSLongitude, gps.GPSLongitudeRef), accuracy: 0 });
    }
  };

  const submit = async () => {
    if (!loc) { setError(new Error(t('useLoc'))); return; }
    setBusy(true); setError(null); setNotice('');
    const fields = { ...Object.fromEntries(Object.entries(form).filter(([, v]) => v)), lat: loc.lat, lng: loc.lng, locationSource: 'gps', source: draft.title ? 'chat' : 'mobile' };
    try {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));
      for (const [i, p] of photos.entries()) await appendImage(fd, 'images', p, i);
      const { data } = await api('/complaints', { method: 'POST', body: fd });
      router.replace(`/complaint/${data._id}`);
    } catch (e) {
      if (e.network) {
        await queueReport(fields, photos);
        setNotice(t('savedOffline'));
        setForm({ title: '', description: '', category: 'auto', ward: '', address: '' });
        setPhotos([]);
      } else setError(e);
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Title sub={t('reportSub')}>{t('reportTitle')}</Title>
      {notice ? <Card><T bold>{notice}</T></Card> : null}
      <Card>
        <Field label={t('shortTitle')} value={form.title} maxLength={120} onChangeText={(title) => setForm({ ...form, title })} />
        <Field label={t('what')} value={form.description} maxLength={2000} multiline placeholder={t('whatPh')} onChangeText={(description) => setForm({ ...form, description })} />
        <T bold size={14}>{t('category')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
          {CATEGORIES.map(([v, l]) => <Chip key={v} label={l} selected={form.category === v} onPress={() => setForm({ ...form, category: v })} />)}
        </View>
        <T bold size={14}>{t('ward')}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
          {wards.map((w) => <Chip key={w} label={w} selected={form.ward === w} onPress={() => setForm({ ...form, ward: w })} />)}
        </View>
        <Field label={t('landmark')} value={form.address} maxLength={200} onChangeText={(address) => setForm({ ...form, address })} />
      </Card>

      <Card>
        <T bold size={14}>{t('location')}</T>
        <T muted size={13}>{loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}${loc.accuracy ? ` (±${Math.round(loc.accuracy)} m)` : ' (from photo)'}` : '—'}</T>
        <Button variant="secondary" title={locBusy ? t('locating') : t('useLoc')} onPress={locate} disabled={locBusy} />
      </Card>

      <Card>
        <T bold size={14}>{t('photos')} ({photos.length}/3)</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {photos.map((p) => <Image key={p.uri} source={{ uri: p.uri }} style={{ width: 80, height: 80, borderRadius: 8 }} accessibilityLabel="Selected photo" />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button variant="secondary" title={t('camera')} onPress={() => pick(true)} disabled={photos.length >= 3} /></View>
          <View style={{ flex: 1 }}><Button variant="secondary" title={t('gallery')} onPress={() => pick(false)} disabled={photos.length >= 3} /></View>
        </View>
      </Card>

      {dups.length > 0 && (
        <Card>
          <T bold>{t('dups')}</T>
          {dups.map((d) => (
            <View key={d.id} style={{ gap: 2 }}>
              <StatusPill status={d.status} />
              <T size={14}>{d.title}</T>
              <T muted size={12}>{d.referenceId} · {d.signals.join(' · ')}</T>
            </View>
          ))}
          <T muted size={12}>{t('dupsHint')}</T>
        </Card>
      )}

      <ErrorText error={error} />
      <Button title={busy ? t('submitting') : t('submit')} onPress={submit} disabled={busy} />
    </Screen>
  );
}
