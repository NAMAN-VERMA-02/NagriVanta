import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { escalateOverdue } from '../src/jobs/sla.js';
import Complaint from '../src/models/Complaint.js';
import ComplaintHistory from '../src/models/ComplaintHistory.js';
import { setAiProvider } from '../src/services/ai.js';
import { runTriage } from '../src/services/complaints.js';
import { DEMO_PASSWORD, seed } from '../scripts/seed.js';

// Two clearly different test photos (solid colours with a different pattern)
const photo = (bg, fg) => sharp({ create: { width: 64, height: 64, channels: 3, background: bg } })
  .composite([{ input: { create: { width: 32, height: 64, channels: 3, background: fg } }, left: 0, top: 0 }]).jpeg().toBuffer();
let BEFORE;
let AFTER;

let mongo;
let app;
const tokens = {};
const rules = () => { const p = async () => { throw new Error('no ai in tests'); }; return p; };

const login = async (email) => (await request(app).post('/api/v1/auth/login').send({ email, password: DEMO_PASSWORD })).body.data.token;
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('nagrivanta-test'));
  await seed({ log: () => {} });
  app = createApp();
  BEFORE = await photo('#808080', '#202020');
  AFTER = await photo('#20a020', '#f0f0f0');
  for (const [k, email] of Object.entries({
    admin: 'admin@nagrivanta.local', pwd: 'pwd.officer@nagrivanta.local', san: 'san.officer@nagrivanta.local',
    noidaPwd: 'noida.pwd.officer@nagrivanta.local', c1: 'citizen1@nagrivanta.local', c2: 'citizen2@nagrivanta.local',
  })) tokens[k] = await login(email);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('register, login, me; bad credentials rejected; role cannot be self-assigned', async () => {
  const reg = await request(app).post('/api/v1/auth/register').send({ name: 'New User', email: 'New@Example.com', password: 'longpassword' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.data.user.role, 'citizen');
  assert.equal(reg.body.data.user.passwordHash, undefined);
  assert.equal((await request(app).post('/api/v1/auth/register').send({ name: 'New User', email: 'new@example.com', password: 'longpassword' })).status, 409);
  assert.equal((await request(app).post('/api/v1/auth/register').send({ name: 'X Y', email: 'x@example.com', password: 'longpassword', role: 'admin' })).status, 400);
  assert.equal((await request(app).post('/api/v1/auth/login').send({ email: 'new@example.com', password: 'wrong' })).status, 401);
  const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${reg.body.data.token}`);
  assert.equal(me.body.data.user.email, 'new@example.com');
  assert.equal((await request(app).get('/api/v1/auth/me')).status, 401);
});

test('full lifecycle: citizen -> admin -> officer -> verified resolve -> reopen -> fresh proof required', async () => {
  const created = await request(app).post('/api/v1/complaints').set(as('c1'))
    .field('title', 'Huge pothole outside metro gate')
    .field('description', 'Deep pothole, two bikes fell yesterday, near the school bus stop.')
    .field('category', 'auto')
    .field('lat', '28.6461').field('lng', '77.3696').field('ward', 'Indirapuram')
    .attach('images', BEFORE, 'p.jpg');
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const c = created.body.data;
  assert.match(c.referenceId, /^CIV-\d{6}-[0-9A-F]{8}$/);
  assert.equal(c.category, 'road');
  assert.equal(c.city, 'Ghaziabad');
  assert.equal(c.aiAnalysis.status, 'fallback', 'triage ran before the response (works on serverless)');
  assert.equal(c.aiAnalysis.engine, 'naive-bayes');
  assert.match(c.images[0], /^\/uploads\/[a-f\d]{32}$/, 'image URL uses a random key, not the ObjectId');
  assert.equal(c.duplicateCandidates, undefined, 'citizen view hides staff fields');

  const img = await request(app).get(c.images[0]);
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-type'], 'image/jpeg');
  assert.equal((await request(app).get(`/uploads/${'0'.repeat(32)}`)).status, 404);

  assert.equal((await request(app).get(`/api/v1/complaints/${c._id}`).set(as('c2'))).status, 404);
  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('c1')).send({ to: 'under_review' })).status, 403);
  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('admin')).send({ to: 'resolved' })).status, 400);
  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('admin')).send({ to: 'under_review' })).status, 200);

  const depts = (await request(app).get('/api/v1/departments?city=Ghaziabad')).body.data;
  const pwd = depts.find((d) => d.code === 'PWD');
  const officers = (await request(app).get('/api/v1/admin/users?role=officer').set(as('admin'))).body.data;
  const pwdOfficer = officers.find((o) => o.email === 'pwd.officer@nagrivanta.local');
  const assigned = await request(app).patch(`/api/v1/complaints/${c._id}/assign`).set(as('admin')).send({ departmentId: pwd._id, assignedTo: pwdOfficer.id });
  assert.equal(assigned.status, 200);
  assert.ok(assigned.body.data.sla.dueAt);

  const citizenView = (await request(app).get(`/api/v1/complaints/${c._id}`).set(as('c1'))).body.data.complaint;
  assert.equal(citizenView.assignedTo.name, pwdOfficer.name);
  assert.equal(citizenView.assignedTo.email, undefined, 'officer email is not exposed to citizens');

  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('san')).send({ to: 'in_progress' })).status, 403);
  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('pwd')).send({ to: 'in_progress' })).status, 200);
  const before = await mongoose.connection.db.collection('uploads').countDocuments();
  const noNote = await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('pwd')).field('to', 'resolved').attach('evidence', AFTER, 'a.jpg');
  assert.equal(noNote.status, 400);
  assert.equal(await mongoose.connection.db.collection('uploads').countDocuments(), before, 'a rejected request stores no photos');

  const resolved = await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('pwd'))
    .field('to', 'resolved').field('note', 'Pothole filled and levelled').attach('evidence', AFTER, 'after.jpg');
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  const v = resolved.body.data.resolution.verification;
  assert.ok(['passed', 'unverified'].includes(v.status));
  assert.equal(v.checks.find((x) => x.name === 'Different from report photo').ok, true);

  const reopened = await request(app).post(`/api/v1/complaints/${c._id}/reopen`).set(as('c1')).send({ reason: 'It sank again after rain' });
  assert.equal(reopened.body.data.status, 'reopened');
  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('pwd')).send({ to: 'in_progress' })).status, 200);
  const reuse = await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('pwd')).send({ to: 'resolved', note: 'done again' });
  assert.equal(reuse.status, 400, 're-resolving needs new evidence');

  // re-using the citizen's own photo as "after" evidence is flagged for review
  const same = await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('pwd'))
    .field('to', 'resolved').field('note', 'Fixed').attach('evidence', BEFORE, 'same.jpg');
  assert.equal(same.status, 200);
  assert.equal(same.body.data.resolution.verification.status, 'needs_review');

  const detail = await request(app).get(`/api/v1/complaints/${c._id}`).set(as('c1'));
  assert.deepEqual(detail.body.data.history.map((h) => h.action),
    ['created', 'status_change', 'assigned', 'status_change', 'status_change', 'reopened', 'status_change', 'status_change']);
  assert.ok(detail.body.data.history.every((h) => !h.internal), 'citizen never sees internal events');
  assert.equal(detail.body.data.integrity.intact, true);
  assert.ok((await request(app).get('/api/v1/notifications').set(as('c1'))).body.meta.unread >= 4);
});

test('audit trail is tamper-evident: editing a history entry breaks the chain', async () => {
  const c = await Complaint.findOne({ status: 'closed' });
  const ok = await request(app).get(`/api/v1/complaints/${c._id}/integrity`).set(as('admin'));
  assert.equal(ok.body.data.intact, true);
  await ComplaintHistory.collection.updateOne({ complaintId: c._id, action: 'feedback' }, { $set: { note: 'edited later' } });
  const broken = await request(app).get(`/api/v1/complaints/${c._id}/integrity`).set(as('admin'));
  assert.equal(broken.body.data.intact, false);
});

test('fake image is rejected and location is required', async () => {
  const fake = await request(app).post('/api/v1/complaints').set(as('c1'))
    .field('title', 'Garbage pile').field('description', 'Garbage everywhere on the road')
    .field('lat', '28.64').field('lng', '77.36').attach('images', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' });
  assert.equal(fake.status, 400);
  const noLoc = await request(app).post('/api/v1/complaints').set(as('c1')).send({ title: 'Garbage pile', description: 'Garbage everywhere on the road' });
  assert.equal(noLoc.status, 400);
});

test('smart routing auto-assigns confident reports to the least-loaded officer in the right city', async () => {
  env.autoAssign = true;
  try {
    const res = await request(app).post('/api/v1/complaints').set(as('c2'))
      .send({ title: 'Streetlight not working', description: 'The street light near the park is off for a week', category: 'streetlight', lat: 28.6270, lng: 77.3725, ward: 'Sector 62 Noida' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'assigned');
    assert.equal(res.body.data.city, 'Noida');
    const full = await Complaint.findById(res.body.data._id).populate('departmentId').populate('assignedTo');
    assert.equal(full.departmentId.city, 'Noida');
    assert.equal(full.departmentId.code, 'ELE');
    assert.equal(full.routing.method, 'auto');
    assert.ok(full.assignedTo);
  } finally {
    env.autoAssign = false;
  }
});

test('AI failure never blocks saving; Gemini output is used when valid', async () => {
  const failing = rules();
  failing.isMock = true;
  setAiProvider(failing);
  const res = await request(app).post('/api/v1/complaints').set(as('c2'))
    .send({ title: 'Light pole wire hanging', description: 'Wires hanging from the light pole near the park', lat: 28.66, lng: 77.36 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.aiAnalysis.status, 'fallback');
  assert.equal(res.body.data.aiAnalysis.category, 'streetlight');

  const malformed = async () => ({ category: 'spaceship', summary: 'x' });
  malformed.isMock = true;
  setAiProvider(malformed);
  assert.equal((await runTriage(res.body.data._id)).aiAnalysis.error, 'Malformed AI output');

  const good = async () => ({ category: 'streetlight', summary: 'Hanging wires on a streetlight pole.', priority: 'high', reasons: ['exposed wires'], confidence: 0.9 });
  good.isMock = true;
  setAiProvider(good);
  const okRes = await runTriage(res.body.data._id);
  assert.equal(okRes.aiAnalysis.status, 'done');
  assert.equal(okRes.aiAnalysis.engine, 'gemini');
  setAiProvider(rules()); // non-mock again: aiEnabled() follows the (empty) key
});

test('community "me too" votes are one per citizen and raise priority', async () => {
  const c = await Complaint.findOne({ reportedBy: { $ne: (await mongoose.connection.db.collection('users').findOne({ email: 'citizen1@nagrivanta.local' }))._id }, status: 'submitted' });
  const first = await request(app).post(`/api/v1/complaints/${c._id}/upvote`).set(as('c1'));
  assert.equal(first.status, 200);
  const again = await request(app).post(`/api/v1/complaints/${c._id}/upvote`).set(as('c1'));
  assert.equal(again.body.data.upvotes, first.body.data.upvotes, 'double vote is idempotent');
  const feed = await request(app).get('/api/v1/complaints').query({ near: '28.646,77.37', sort: 'top' }).set(as('c1'));
  assert.equal(feed.status, 200);
  assert.ok(feed.body.data.every((x) => x.title && x.reportedBy === undefined));
  const undo = await request(app).delete(`/api/v1/complaints/${c._id}/upvote`).set(as('c1'));
  assert.equal(undo.body.data.upvotes, first.body.data.upvotes - 1);
});

test('date filters treat "to" as the whole local day', async () => {
  const today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
  const res = await request(app).get('/api/v1/complaints').query({ from: today, to: today }).set(as('admin'));
  assert.equal(res.status, 200);
  assert.ok(res.body.meta.total >= 1, 'reports filed today are included');
});

test('analytics, scorecard, risk alerts and open data', async () => {
  assert.equal((await request(app).get('/api/v1/admin/analytics').set(as('c1'))).status, 403);
  const a = await request(app).get('/api/v1/admin/analytics?city=Ghaziabad').set(as('admin'));
  assert.equal(a.status, 200);
  assert.ok(a.body.data.total > 50);
  assert.ok(Array.isArray(a.body.data.hotspots));
  assert.ok(Array.isArray(a.body.data.workload));
  const s = await request(app).get('/api/v1/public/scorecard?city=Noida');
  assert.ok(s.body.data.wards.every((w) => w.ward.includes('Noida')));
  const risk = await request(app).get('/api/v1/public/risk-alerts');
  assert.equal(risk.body.data.weatherAvailable, false);
  assert.ok(risk.body.data.alerts.length > 0, 'history-only baseline still raises recurring alerts');
  const csv = await request(app).get('/api/v1/public/open-data.csv');
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.ok(csv.text.startsWith('reference_id,category'));
  assert.ok(!/citizen|@/.test(csv.text), 'no personal data in open data');
});

test('Open311 GeoReport v2: list, read and create with an API key', async () => {
  const svc = await request(app).get('/open311/v2/services.json');
  assert.ok(svc.body.some((x) => x.service_code === 'road'));
  const list = await request(app).get('/open311/v2/requests.json?status=open');
  assert.ok(list.body.length > 0);
  assert.equal((await request(app).post('/open311/v2/requests.json').type('form').send({ api_key: 'wrong-key-123', service_code: 'road', lat: 28.64, long: 77.37, description: 'Pothole on the main road' })).status, 403);
  const created = await request(app).post('/open311/v2/requests.json').type('form')
    .send({ api_key: 'test-open311-key', service_code: 'garbage', lat: 28.5708, long: 77.3261, description: 'Garbage dumped near the market gate', account_id: 'PARTNER-42' });
  assert.equal(created.status, 201);
  const id = created.body[0].service_request_id;
  const one = await request(app).get(`/open311/v2/requests/${id}.json`);
  assert.equal(one.body[0].account_id, 'PARTNER-42');
  assert.equal((await Complaint.findOne({ referenceId: id })).city, 'Noida');
});

test('assistant drafts reports (English + Hindi), answers status, handles emergencies', async () => {
  const draft = await request(app).post('/api/v1/assistant/chat').send({ messages: [{ role: 'user', content: 'There is a big pothole near Kavi Nagar market, bikes are falling' }] });
  assert.equal(draft.body.data.intent, 'report');
  assert.equal(draft.body.data.draft.category, 'road');
  const hi = await request(app).post('/api/v1/assistant/chat').send({ messages: [{ role: 'user', content: 'हमारी गली में 3 दिन से कूड़ा पड़ा है' }] });
  assert.equal(hi.body.data.draft.category, 'garbage');
  assert.match(hi.body.data.reply, /\p{Script=Devanagari}/u);
  const ref = (await Complaint.findOne({ status: 'assigned' })).referenceId;
  const status = await request(app).post('/api/v1/assistant/chat').send({ messages: [{ role: 'user', content: `status of ${ref}?` }] });
  assert.match(status.body.data.reply, /Assigned/);
  const sos = await request(app).post('/api/v1/assistant/chat').send({ messages: [{ role: 'user', content: 'there was an accident here' }] });
  assert.match(sos.body.data.reply, /112/);
});

test('cron endpoint requires the secret; SLA job escalates exactly once', async () => {
  assert.equal((await request(app).get('/api/v1/jobs/sla')).status, 403);
  assert.equal((await request(app).get('/api/v1/jobs/sla').set('Authorization', 'Bearer nope')).status, 403);
  const okRun = await request(app).get('/api/v1/jobs/sla').set('Authorization', 'Bearer test-cron-secret');
  assert.equal(okRun.status, 200);
  assert.ok(okRun.body.data.escalated > 0);
  assert.equal(await escalateOverdue(), 0);
});
