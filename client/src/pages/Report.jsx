import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CircleCheck, Copy, ImagePlus, LocateFixed, TriangleAlert } from 'lucide-react';
import { MapPicker } from '../components/Maps';
import { ErrorBox, PageTitle, StatusBadge } from '../components/ui';
import { api } from '../services/api';
import { CATEGORIES } from '../utils/format';

const WARDS = ['Indirapuram', 'Vaishali', 'Raj Nagar Extension', 'Kavi Nagar', 'Sector 62 Noida', 'Vasundhara', 'Other'];

export default function Report() {
  const [form, setForm] = useState({ title: '', description: '', category: 'auto', ward: '', address: '' });
  const [loc, setLoc] = useState(null);
  const [files, setFiles] = useState([]);
  const [dups, setDups] = useState([]);
  const [geoMsg, setGeoMsg] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // live duplicate hints, debounced
  useEffect(() => {
    if (!loc || form.title.length + form.description.length < 8) { setDups([]); return undefined; }
    const t = setTimeout(() => {
      api('/complaints/nearby', { query: { lat: loc.lat, lng: loc.lng, text: `${form.title} ${form.description}`, category: form.category } })
        .then(({ data }) => setDups(data)).catch(() => setDups([]));
    }, 600);
    return () => clearTimeout(t);
  }, [loc, form.title, form.description, form.category]);

  const locate = () => {
    if (!navigator.geolocation) { setGeoMsg('Location is not available in this browser. Click the map instead.'); return; }
    setGeoMsg('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoMsg(`Accuracy about ${Math.round(p.coords.accuracy)} m`); },
      () => setGeoMsg('Could not get your location. Click the map to place the pin.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onFiles = (e) => {
    const picked = [...e.target.files].slice(0, 3);
    const tooBig = picked.find((f) => f.size > 5 * 1024 * 1024);
    if (tooBig) { setError({ message: `${tooBig.name} is larger than 5 MB` }); return; }
    setError(null);
    setFiles(picked);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!loc) { setError({ message: 'Please set the location: use "Use my location" or click on the map.' }); return; }
    setBusy(true); setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    fd.append('lat', loc.lat);
    fd.append('lng', loc.lng);
    fd.append('source', 'web');
    files.forEach((f) => fd.append('images', f));
    try {
      const { data } = await api('/complaints', { method: 'POST', body: fd });
      setDone(data);
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg card p-8 text-center">
        <CircleCheck className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">Report submitted</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Your reference ID</p>
        <p className="mt-1 flex items-center justify-center gap-2 font-mono text-xl font-bold">
          {done.referenceId}
          <button type="button" className="btn-ghost p-1" aria-label="Copy reference ID" onClick={() => navigator.clipboard?.writeText(done.referenceId)}><Copy className="h-4 w-4" aria-hidden /></button>
        </p>
        <p className="mt-4 text-sm text-slate-500">AI triage runs in the background; staff will review it shortly.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to={`/complaints/${done._id}`} className="btn-primary">Track this report</Link>
          <button type="button" className="btn-secondary" onClick={() => { setDone(null); setForm({ title: '', description: '', category: 'auto', ward: '', address: '' }); setFiles([]); setLoc(null); }}>Report another</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageTitle title="Report a civic issue" subtitle="Clear details and a photo help the right team fix it faster." />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-5" noValidate>
        <div className="card space-y-4 p-6 lg:col-span-3">
          <ErrorBox error={error} />
          <div>
            <label className="label" htmlFor="title">Short title</label>
            <input id="title" className="input" maxLength={120} required placeholder="e.g. Deep pothole outside metro gate" value={form.title} onChange={set('title')} />
          </div>
          <div>
            <label className="label" htmlFor="desc">What is the problem?</label>
            <textarea id="desc" className="input min-h-28" maxLength={2000} required placeholder="Where exactly, how long, any safety risk… English or Hindi is fine." value={form.description} onChange={set('description')} />
            <p className="mt-1 text-xs text-slate-500">{form.description.length}/2000</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cat">Category</label>
              <select id="cat" className="input" value={form.category} onChange={set('category')}>
                <option value="auto">Not sure: let AI suggest</option>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ward">Ward / area</label>
              <select id="ward" className="input" value={form.ward} onChange={set('ward')}>
                <option value="">Select…</option>
                {WARDS.map((w) => <option key={w}>{w}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="addr">Landmark / address (optional)</label>
            <input id="addr" className="input" maxLength={200} value={form.address} onChange={set('address')} />
          </div>
          <div>
            <span className="label">Photos (up to 3, max 5 MB each)</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-brand-500 dark:border-slate-700 dark:text-slate-400">
              <ImagePlus className="h-6 w-6" aria-hidden />
              {files.length ? files.map((f) => f.name).join(', ') : 'Choose or take photos (JPG, PNG, WEBP)'}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" onChange={onFiles} />
            </label>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="label mb-0">Location</span>
              <button type="button" className="btn-secondary px-3 py-1.5" onClick={locate}><LocateFixed className="h-4 w-4" aria-hidden /> Use my location</button>
            </div>
            <MapPicker value={loc} onChange={setLoc} />
            <p className="mt-2 text-xs text-slate-500" aria-live="polite">
              {loc ? `Pin at ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}. ` : 'Click the map to drop a pin. '}{geoMsg}
            </p>
          </div>

          {dups.length > 0 && (
            <div className="card border-amber-300 p-4 dark:border-amber-800" aria-live="polite">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300"><TriangleAlert className="h-4 w-4" aria-hidden /> Possibly already reported nearby</p>
              <ul className="mt-3 space-y-2">
                {dups.map((d) => (
                  <li key={d.id} className="rounded-lg bg-slate-50 p-2 text-sm dark:bg-ink-800">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{d.title}</span><StatusBadge status={d.status} /></div>
                    <p className="mt-1 text-xs text-slate-500">{d.referenceId} · {d.signals.join(' · ')}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">You can still submit. Staff will decide if it is the same issue.</p>
            </div>
          )}

          <button className="btn-primary w-full py-3 text-base" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button>
          <p className="text-xs text-slate-500">Your name and exact location are only visible to staff. Public views show rounded locations.</p>
        </div>
      </form>
    </>
  );
}
