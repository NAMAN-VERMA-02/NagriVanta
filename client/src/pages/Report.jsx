import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { CircleCheck, Copy, ImagePlus, LocateFixed, Mic, MicOff, TriangleAlert, Video, X } from 'lucide-react';
import { MapPicker } from '../components/Maps';
import { ErrorBox, PageTitle, StatusBadge } from '../components/ui';
import { usePrefs } from '../context/PrefsContext';
import { useSpeech } from '../hooks/useSpeech';
import { CATEGORY_HI } from '../i18n';
import { api } from '../services/api';
import { CATEGORIES } from '../utils/format';
import { MAX_BODY_BYTES, compressImage, readPhotoMeta } from '../utils/media';
import { queueReport } from '../utils/offlineQueue';

const EMPTY = { title: '', description: '', category: 'auto', city: '', ward: '', address: '' };

export default function Report() {
  const { t, lang, lite, online } = usePrefs();
  const location = useLocation();
  const draft = location.state?.draft;
  const [form, setForm] = useState(() => ({ ...EMPTY, ...(draft && { title: draft.title || '', description: draft.description || '', category: draft.category || 'auto' }) }));
  const [source, setSource] = useState(draft ? 'chat' : 'web');
  const [cities, setCities] = useState([]);
  const [loc, setLoc] = useState(null);
  const [locFrom, setLocFrom] = useState('');
  const [photos, setPhotos] = useState([]);
  const [video, setVideo] = useState(null);
  const [dups, setDups] = useState([]);
  const [geoMsg, setGeoMsg] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const speech = useSpeech(lang, (text) => {
    setForm((f) => ({ ...f, description: `${f.description} ${text}`.trim(), title: f.title || text.slice(0, 80) }));
    setSource('voice');
  });

  useEffect(() => { api('/cities').then(({ data }) => setCities(data)).catch(() => {}); }, []);

  const wards = cities.find((c) => c.name === form.city)?.wards || cities.flatMap((c) => c.wards);
  const pickWard = (e) => {
    const ward = e.target.value;
    const city = cities.find((c) => c.wards.some((w) => w.name === ward))?.name || form.city;
    setForm({ ...form, ward, city });
  };

  // live duplicate hints, debounced
  useEffect(() => {
    if (!loc || !online || form.title.length + form.description.length < 8) { setDups([]); return undefined; }
    const tm = setTimeout(() => {
      api('/complaints/nearby', { query: { lat: loc.lat, lng: loc.lng, text: `${form.title} ${form.description}`, category: form.category } })
        .then(({ data }) => setDups(data)).catch(() => setDups([]));
    }, 600);
    return () => clearTimeout(tm);
  }, [loc, online, form.title, form.description, form.category]);

  const locate = () => {
    if (!navigator.geolocation) { setGeoMsg(t('report.clickMap')); return; }
    setGeoMsg('…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocFrom('gps'); setGeoMsg(`±${Math.round(p.coords.accuracy)} m`); },
      () => setGeoMsg(t('report.clickMap')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onPhotos = async (e) => {
    const picked = [...e.target.files].slice(0, 3 - photos.length);
    e.target.value = '';
    setError(null);
    for (const original of picked) {
      // read GPS from the original first: compression strips EXIF
      const meta = await readPhotoMeta(original);
      if (!loc && meta.lat != null) { setLoc({ lat: meta.lat, lng: meta.lng }); setLocFrom('photo'); }
      const file = await compressImage(original, lite ? { maxSide: 1024, quality: 0.6 } : {});
      setPhotos((p) => [...p, { file, url: URL.createObjectURL(file) }].slice(0, 3));
    }
  };

  const onVideo = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { setError({ message: 'Video must be under 3 MB (about 10 seconds). Trim it and try again.' }); return; }
    setVideo(f);
  };

  const totalBytes = photos.reduce((s, p) => s + p.file.size, 0) + (video?.size || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!loc && !photos.length) { setError({ message: `${t('report.location')}: ${t('report.useLoc')} / ${t('report.clickMap')}` }); return; }
    if (totalBytes > MAX_BODY_BYTES) { setError({ message: 'Photos and video together must be under 4 MB. Remove one or turn on Lite mode for smaller photos.' }); return; }
    setBusy(true); setError(null);
    const fields = {
      ...Object.fromEntries(Object.entries(form).filter(([, v]) => v)),
      ...(loc && { lat: loc.lat, lng: loc.lng, locationSource: locFrom === 'gps' ? 'gps' : 'map' }),
      source,
    };
    const files = [...photos.map((p) => ({ field: 'images', file: p.file })), ...(video ? [{ field: 'videos', file: video }] : [])];
    if (!online) {
      await queueReport(fields, files);
      setDone({ offline: true });
      setBusy(false);
      return;
    }
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    files.forEach((f) => fd.append(f.field, f.file));
    try {
      const { data } = await api('/complaints', { method: 'POST', body: fd });
      setDone(data);
    } catch (err) {
      if (err.status === 0) { await queueReport(fields, files); setDone({ offline: true }); } else setError(err);
    } finally { setBusy(false); }
  };

  const reset = () => { setDone(null); setForm(EMPTY); setPhotos([]); setVideo(null); setLoc(null); setSource('web'); };

  if (done) {
    return (
      <div className="mx-auto max-w-lg card p-8 text-center">
        <CircleCheck className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">{t('report.done')}</h1>
        {done.offline ? <p className="mt-3 text-slate-600 dark:text-slate-400">{t('report.savedOffline')}</p> : (
          <>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{t('report.ref')}</p>
            <p className="mt-1 flex items-center justify-center gap-2 font-mono text-xl font-bold">
              {done.referenceId}
              <button type="button" className="btn-ghost p-1" aria-label="Copy reference ID" onClick={() => navigator.clipboard?.writeText(done.referenceId)}><Copy className="h-4 w-4" aria-hidden /></button>
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2"><StatusBadge status={done.status} /></div>
            {done.aiAnalysis?.summary && <p className="mt-3 text-sm italic text-slate-500">“{done.aiAnalysis.summary}”</p>}
          </>
        )}
        <div className="mt-6 flex justify-center gap-3">
          {!done.offline && <Link to={`/complaints/${done._id}`} className="btn-primary">{t('report.track')}</Link>}
          <button type="button" className="btn-secondary" onClick={reset}>{t('report.another')}</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageTitle title={t('report.title')} subtitle={t('report.sub')} />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-5" noValidate>
        <div className="card space-y-4 p-6 lg:col-span-3">
          <ErrorBox error={error} />
          <div>
            <label className="label" htmlFor="title">{t('report.short')}</label>
            <input id="title" className="input" maxLength={120} required value={form.title} onChange={set('title')} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="label mb-0" htmlFor="desc">{t('report.what')}</label>
              <button type="button" onClick={() => (speech.listening ? speech.stop() : speech.start() || setError({ message: t('report.noSpeech') }))}
                aria-pressed={speech.listening}
                className={`btn px-3 py-1.5 text-xs ${speech.listening ? 'animate-pulse bg-red-600 text-white' : 'btn-secondary'}`}>
                {speech.listening ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
                {speech.listening ? t('report.listening') : `${t('report.speak')} (${lang === 'hi' ? 'हिंदी' : 'English'})`}
              </button>
            </div>
            <textarea id="desc" className="input min-h-28" maxLength={2000} required placeholder={t('report.whatPh')} value={form.description} onChange={set('description')} />
            <p className="mt-1 text-xs text-slate-500">{form.description.length}/2000{source !== 'web' && ` · via ${source}`}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="cat">{t('report.category')}</label>
              <select id="cat" className="input" value={form.category} onChange={set('category')}>
                <option value="auto">{t('report.auto')}</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {lang === 'hi' ? CATEGORY_HI[c.value] : c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="city">{t('report.city')}</label>
              <select id="city" className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value, ward: '' })}>
                <option value="">{t('report.select')}</option>
                {cities.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ward">{t('report.ward')}</label>
              <select id="ward" className="input" value={form.ward} onChange={pickWard}>
                <option value="">{t('report.select')}</option>
                {wards.map((w) => <option key={w.name}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="addr">{t('report.landmark')}</label>
            <input id="addr" className="input" maxLength={200} value={form.address} onChange={set('address')} />
          </div>
          <div>
            <span className="label">{t('report.media')}</span>
            <div className="flex flex-wrap gap-3">
              {photos.map((p, i) => (
                <div key={p.url} className="relative">
                  <img src={p.url} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                  <button type="button" onClick={() => setPhotos(photos.filter((x) => x !== p))} className="absolute -right-2 -top-2 rounded-full bg-slate-900 p-0.5 text-white" aria-label={`Remove photo ${i + 1}`}><X className="h-3.5 w-3.5" aria-hidden /></button>
                </div>
              ))}
              {photos.length < 3 && (
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-brand-500 dark:border-slate-700">
                  <ImagePlus className="h-5 w-5" aria-hidden /> Photo
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" onChange={onPhotos} />
                </label>
              )}
              <label className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs ${video ? 'border-brand-500 text-brand-700' : 'border-slate-300 text-slate-500 hover:border-brand-500 dark:border-slate-700'}`}>
                <Video className="h-5 w-5" aria-hidden /> {video ? 'Video ✓' : 'Video'}
                <input type="file" accept="video/mp4,video/webm,video/quicktime" capture="environment" className="sr-only" onChange={onVideo} />
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('report.mediaHint')} {(totalBytes / 1024 / 1024).toFixed(1)} / 4 MB</p>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="label mb-0">{t('report.location')}</span>
              <button type="button" className="btn-secondary px-3 py-1.5" onClick={locate}><LocateFixed className="h-4 w-4" aria-hidden /> {t('report.useLoc')}</button>
            </div>
            <MapPicker value={loc} onChange={(v) => { setLoc(v); setLocFrom('map'); }} height={lite ? 200 : 320} />
            <p className="mt-2 text-xs text-slate-500" aria-live="polite">
              {loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}. ` : `${t('report.clickMap')} `}
              {locFrom === 'photo' && t('report.fromPhoto')} {geoMsg}
            </p>
          </div>

          {dups.length > 0 && (
            <div className="card border-amber-300 p-4 dark:border-amber-800" aria-live="polite">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300"><TriangleAlert className="h-4 w-4" aria-hidden /> {t('report.dups')}</p>
              <ul className="mt-3 space-y-2">
                {dups.map((d) => (
                  <li key={d.id} className="rounded-lg bg-slate-50 p-2 text-sm dark:bg-ink-800">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{d.title}</span><StatusBadge status={d.status} /></div>
                    <p className="mt-1 text-xs text-slate-500">{d.referenceId} · {d.signals.join(' · ')}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">{t('report.dupsHint')} <Link className="font-semibold text-brand-700 dark:text-brand-500" to="/community">{t('nav.community')} →</Link></p>
            </div>
          )}

          <button className="btn-primary w-full py-3 text-base" disabled={busy}>{busy ? t('report.submitting') : t('report.submit')}</button>
          <p className="text-xs text-slate-500">{t('report.privacy')}</p>
        </div>
      </form>
    </>
  );
}
