import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertTransition, allowedNext } from '../src/services/workflow.js';
import { ruleCategory, scorePriority } from '../src/services/rules.js';
import { scoreCandidate } from '../src/services/duplicates.js';
import { textSimilarity } from '../src/utils/text.js';
import { hammingHex } from '../src/middleware/upload.js';
import { scoreWardRisk } from '../src/services/risk.js';
import { localTriage } from '../src/services/ai.js';
import { historyDigest } from '../src/services/workflow.js';
import { nearestCity } from '../src/config/constants.js';

const admin = { _id: 'a', role: 'admin' };
const officer = { _id: 'o1', role: 'officer', departmentId: 'd1' };
const citizen = { _id: 'c', role: 'citizen' };

test('valid transitions pass, invalid ones throw', () => {
  assert.doesNotThrow(() => assertTransition({ status: 'submitted' }, 'under_review', admin));
  assert.throws(() => assertTransition({ status: 'submitted' }, 'resolved', admin), /Cannot move/);
  assert.throws(() => assertTransition({ status: 'submitted' }, 'under_review', citizen), /role/);
  assert.throws(() => assertTransition({ status: 'closed' }, 'in_progress', admin), /Cannot move/);
});

test('officer may act only on own department / assignment', () => {
  assert.doesNotThrow(() => assertTransition({ status: 'assigned', departmentId: 'd1' }, 'in_progress', officer));
  assert.throws(() => assertTransition({ status: 'assigned', departmentId: 'd2', assignedTo: 'x' }, 'in_progress', officer), /not assigned/);
});

test('resolving needs a note and evidence; rejecting needs a reason', () => {
  const c = { status: 'in_progress', departmentId: 'd1' };
  assert.throws(() => assertTransition(c, 'resolved', officer, {}), /note/);
  assert.throws(() => assertTransition(c, 'resolved', officer, { note: 'done' }), /after-photo/);
  assert.doesNotThrow(() => assertTransition(c, 'resolved', officer, { note: 'done', evidenceCount: 1 }));
  // old evidence from an earlier resolution does not count
  assert.throws(() => assertTransition({ ...c, resolution: { evidence: ['/uploads/old'] } }, 'resolved', officer, { note: 'again' }), /new after-photo/);
  assert.throws(() => assertTransition({ status: 'submitted' }, 'rejected', admin, {}), /reason/);
});

test('allowedNext respects roles', () => {
  assert.deepEqual(allowedNext('in_progress', 'officer').sort(), ['blocked', 'resolved']);
  assert.deepEqual(allowedNext('submitted', 'citizen'), []);
});

test('rule classifier handles English, Hinglish and Hindi', () => {
  assert.equal(ruleCategory('Deep pothole on the main road').category, 'road');
  assert.equal(ruleCategory('gali me kooda pada hai').category, 'garbage');
  assert.equal(ruleCategory('नाली जाम है').category, 'drainage');
  assert.equal(ruleCategory('streetlight not working').category, 'streetlight');
  assert.equal(ruleCategory('hello there').category, 'other');
});

test('priority score is explainable and escalates safety risks', () => {
  const low = scorePriority({ text: 'bench is a bit old', category: 'other' });
  const high = scorePriority({ text: 'open manhole near school, children can fall, blocked for days', category: 'drainage' });
  assert.equal(low.priority, 'low');
  assert.equal(high.priority, 'critical');
  assert.equal(high.total, high.factors.reduce((s, f) => s + f.points, 0));
});

test('duplicate scoring prefers close, similar, same-category reports', () => {
  const me = { coords: [77.37, 28.646], text: 'big pothole near school gate', category: 'road' };
  const close = { location: { coordinates: [77.3701, 28.6461] }, title: 'Pothole near school gate', description: 'deep pothole', category: 'road' };
  const far = { location: { coordinates: [77.372, 28.648] }, title: 'Streetlight off', description: 'dark lane', category: 'streetlight' };
  assert.ok(scoreCandidate(me, close).score > 0.6);
  assert.ok(scoreCandidate(me, far).score < 0.3);
  assert.ok(textSimilarity('a b c', 'x y z') === 0);
});

test('photo signal: near-identical photos raise the duplicate score', () => {
  const me = { coords: [77.37, 28.646], text: 'garbage dump', category: 'garbage', hashes: ['ffff0000ffff0000'] };
  const base = { location: { coordinates: [77.3705, 28.6462] }, title: 'Waste pile', description: 'rubbish', category: 'garbage' };
  const samePhoto = scoreCandidate(me, { ...base, imageHashes: ['ffff0000ffff0001'] });
  const otherPhoto = scoreCandidate(me, { ...base, imageHashes: ['0000ffff0000ffff'] });
  assert.ok(samePhoto.score > otherPhoto.score);
  assert.ok(samePhoto.signals.some((s) => s.startsWith('similar photo')));
  assert.equal(hammingHex('ff', '00'), 8);
});

test('risk scoring combines rain forecast with ward history', () => {
  assert.deepEqual(scoreWardRisk({ rainMm: 0, drainage: 0 }), []);
  assert.equal(scoreWardRisk({ rainMm: 35, drainage: 3 })[0].level, 'high');
  assert.equal(scoreWardRisk({ rainMm: 0, drainage: 3, water: 2 })[0].type, 'recurring');
});

test('trained classifier understands Hinglish and Hindi', () => {
  assert.equal(localTriage('pipe se paani beh raha hai', '').category, 'water');
  assert.equal(localTriage('bada gaddha hai road pe', '').category, 'road');
  assert.equal(localTriage('गली में कूड़ा पड़ा है', '').category, 'garbage');
});

test('history digest changes when any field changes', () => {
  const e = { complaintId: 'a', action: 'note', note: 'x', createdAt: new Date(0) };
  assert.notEqual(historyDigest(e, 'GENESIS'), historyDigest({ ...e, note: 'y' }, 'GENESIS'));
  assert.notEqual(historyDigest(e, 'GENESIS'), historyDigest(e, 'other-prev'));
});

test('nearest city from coordinates', () => {
  assert.equal(nearestCity(28.5708, 77.3261), 'Noida');
  assert.equal(nearestCity(28.6729, 77.4497), 'Ghaziabad');
});
