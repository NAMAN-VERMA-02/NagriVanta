import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { escalateOverdue } from '../src/jobs/sla.js';
import Complaint from '../src/models/Complaint.js';
import { setAiProvider } from '../src/services/ai.js';
import { runTriage } from '../src/services/complaints.js';
import { DEMO_PASSWORD, seed } from '../scripts/seed.js';

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let mongo;
let app;
const tokens = {};

const login = async (email) => (await request(app).post('/api/v1/auth/login').send({ email, password: DEMO_PASSWORD })).body.data.token;
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('civiclens-test'));
  await seed({ log: () => {} });
  app = createApp();
  tokens.admin = await login('admin@civiclens.local');
  tokens.pwd = await login('pwd.officer@civiclens.local');
  tokens.san = await login('san.officer@civiclens.local');
  tokens.c1 = await login('citizen1@civiclens.local');
  tokens.c2 = await login('citizen2@civiclens.local');
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

test('register, login, me; bad credentials rejected; unknown fields rejected', async () => {
  const reg = await request(app).post('/api/v1/auth/register').send({ name: 'New User', email: 'New@Example.com', password: 'longpassword' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.data.user.role, 'citizen');
  assert.equal(reg.body.data.user.passwordHash, undefined);
  const dup = await request(app).post('/api/v1/auth/register').send({ name: 'New User', email: 'new@example.com', password: 'longpassword' });
  assert.equal(dup.status, 409);
  const escalate = await request(app).post('/api/v1/auth/register').send({ name: 'X Y', email: 'x@example.com', password: 'longpassword', role: 'admin' });
  assert.equal(escalate.status, 400, 'role cannot be self-assigned');
  const bad = await request(app).post('/api/v1/auth/login').send({ email: 'new@example.com', password: 'wrong' });
  assert.equal(bad.status, 401);
  const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${reg.body.data.token}`);
  assert.equal(me.body.data.user.email, 'new@example.com');
  assert.equal((await request(app).get('/api/v1/auth/me')).status, 401);
});

test('full lifecycle: citizen -> admin -> officer -> resolve -> reopen', async () => {
  const created = await request(app).post('/api/v1/complaints').set(as('c1'))
    .field('title', 'Huge pothole outside metro gate')
    .field('description', 'Deep pothole, two bikes fell yesterday, near the school bus stop.')
    .field('category', 'auto')
    .field('lat', '28.6461').field('lng', '77.3696').field('ward', 'Indirapuram')
    .attach('images', PNG, 'p.png');
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const c = created.body.data;
  assert.match(c.referenceId, /^CIV-\d{6}-[0-9A-F]{6}$/);
  assert.equal(c.category, 'road');
  assert.equal(c.images.length, 1);
  assert.equal(c.duplicateCandidates, undefined, 'citizen view hides staff fields');

  // other citizen cannot read it, officer of another department cannot act on it
  assert.equal((await request(app).get(`/api/v1/complaints/${c._id}`).set(as('c2'))).status, 404);

  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('c1')).send({ to: 'under_review' })).status, 403);
  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('admin')).send({ to: 'resolved' })).status, 400);
  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('admin')).send({ to: 'under_review' })).status, 200);

  const depts = (await request(app).get('/api/v1/departments')).body.data;
  const pwd = depts.find((d) => d.code === 'PWD');
  const assigned = await request(app).patch(`/api/v1/complaints/${c._id}/assign`).set(as('admin')).send({ departmentId: pwd._id });
  assert.equal(assigned.status, 200);
  assert.ok(assigned.body.data.sla.dueAt);

  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('san')).send({ to: 'in_progress' })).status, 403);
  assert.equal((await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('pwd')).send({ to: 'in_progress' })).status, 200);
  const noEvidence = await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('pwd')).field('to', 'resolved').field('note', 'Filled');
  assert.equal(noEvidence.status, 400);
  const resolved = await request(app).patch(`/api/v1/complaints/${c._id}/status`).set(as('pwd'))
    .field('to', 'resolved').field('note', 'Pothole filled and levelled').attach('evidence', PNG, 'after.png');
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));

  const reopened = await request(app).post(`/api/v1/complaints/${c._id}/reopen`).set(as('c1')).send({ reason: 'It sank again after rain' });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.data.status, 'reopened');

  const detail = await request(app).get(`/api/v1/complaints/${c._id}`).set(as('c1'));
  const actions = detail.body.data.history.map((h) => h.action);
  assert.deepEqual(actions, ['created', 'status_change', 'assigned', 'status_change', 'status_change', 'reopened']);
  assert.ok(detail.body.data.history.every((h) => !h.internal), 'citizen never sees internal events');

  const notes = await request(app).get('/api/v1/notifications').set(as('c1'));
  assert.ok(notes.body.meta.unread >= 4);
});

test('fake image is rejected', async () => {
  const res = await request(app).post('/api/v1/complaints').set(as('c1'))
    .field('title', 'Garbage pile').field('description', 'Garbage everywhere on the road')
    .field('lat', '28.64').field('lng', '77.36').attach('images', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' });
  assert.equal(res.status, 400);
});

test('AI failure never blocks saving; malformed AI output falls back to rules', async () => {
  const failing = async () => { throw new Error('provider down'); };
  failing.isMock = true;
  setAiProvider(failing);
  const res = await request(app).post('/api/v1/complaints').set(as('c2'))
    .send({ title: 'Streetlight not working', description: 'The street light near park is off for a week', lat: 28.66, lng: 77.36 });
  assert.equal(res.status, 201);
  const c = await runTriage(res.body.data._id);
  assert.equal(c.aiAnalysis.status, 'fallback');
  assert.equal(c.aiAnalysis.error, 'provider down');
  assert.equal(c.aiAnalysis.category, 'streetlight');

  const malformed = async () => ({ category: 'spaceship', summary: 'x' });
  malformed.isMock = true;
  setAiProvider(malformed);
  assert.equal((await runTriage(res.body.data._id)).aiAnalysis.error, 'Malformed AI output');

  const good = async () => ({ category: 'streetlight', summary: 'Streetlight near park off for a week.', priority: 'medium', reasons: ['light is off'], confidence: 0.9 });
  good.isMock = true;
  setAiProvider(good);
  const ok = await runTriage(res.body.data._id);
  assert.equal(ok.aiAnalysis.status, 'done');
  assert.equal(ok.category, 'streetlight', 'citizen-chosen category is not overwritten');
});

test('duplicate candidates are suggested for a nearby similar report', async () => {
  const seeded = await Complaint.findOne({ category: 'garbage', status: 'submitted' });
  const [lng, lat] = seeded.location.coordinates;
  const res = await request(app).get('/api/v1/complaints/nearby').set(as('c2'))
    .query({ lat, lng, text: `${seeded.title} ${seeded.description}`, category: 'garbage' });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.some((d) => d.referenceId === seeded.referenceId));
});

test('analytics is staff-only; public scorecard suppresses small groups', async () => {
  assert.equal((await request(app).get('/api/v1/admin/analytics').set(as('c1'))).status, 403);
  const a = await request(app).get('/api/v1/admin/analytics').set(as('admin'));
  assert.equal(a.status, 200);
  assert.ok(a.body.data.total >= 120);
  assert.ok(a.body.data.overdue > 0);
  const s = await request(app).get('/api/v1/public/scorecard');
  assert.equal(s.status, 200);
  assert.ok(s.body.data.wards.length > 0);
  assert.ok(!JSON.stringify(s.body).includes('reportedBy'));
});

test('SLA job escalates overdue cases exactly once', async () => {
  const first = await escalateOverdue();
  assert.ok(first > 0);
  assert.equal(await escalateOverdue(), 0);
});
