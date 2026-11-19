import test from 'node:test';
import assert from 'node:assert/strict';
import { ageFrom } from '../../shared/profile.js';
import { PACES, PACE_FACTORS, recommendedPace } from '../../shared/pace.js';
import { parseHHMM, isEvening } from '../../shared/evening.js';
import { COLLECTION_KEY, defaultCollection, loadCollection, saveCollection } from '../../shared/store.js';
import { recommendations, applyRecommendation, ignoreRecommendation } from '../../shared/recommendations.js';
import { effectiveSettings } from '../../shared/effective.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } };
}
const boom = () => { throw new Error('boom'); };
const throwing = { getItem: boom, setItem: boom, removeItem: boom };
const at = (h, m = 0) => new Date(2026, 10, 19, h, m);

test('ageFrom around birthday', () => {
  assert.equal(ageFrom({ month: 11, year: 2020 }, new Date(2026, 10, 19)), 6);
  assert.equal(ageFrom({ month: 12, year: 2020 }, new Date(2026, 10, 19)), 5);
  assert.equal(ageFrom({ month: 1, year: 2020 }, new Date(2026, 10, 19)), 6);
  assert.equal(ageFrom({ month: 10, year: 2020 }, new Date(2026, 10, 19)), 6);
});

test('pace table', () => {
  assert.deepEqual(PACES, ['calme', 'normal', 'rapide']);
  assert.deepEqual(PACE_FACTORS.calme, { transition: 2.5, anim: 1.5, greenWindow: 1.5, particles: 0.5 });
  assert.deepEqual(PACE_FACTORS.normal, { transition: 1, anim: 1, greenWindow: 1, particles: 1 });
  assert.deepEqual(PACE_FACTORS.rapide, { transition: 0.6, anim: 1, greenWindow: 1, particles: 1 });
  assert.equal(recommendedPace(5), 'calme');
  assert.equal(recommendedPace(6), 'calme');
  assert.equal(recommendedPace(7), 'normal');
  assert.equal(recommendedPace(12), 'normal');
});

test('parseHHMM', () => {
  assert.equal(parseHHMM('19:00'), 1140);
  assert.equal(parseHHMM('07:05'), 425);
});

test('isEvening 19:00 -> 07:00', () => {
  const w = { enabled: true, start: '19:00', end: '07:00' };
  assert.equal(isEvening(at(18, 59), w), false);
  assert.equal(isEvening(at(19, 0), w), true);
  assert.equal(isEvening(at(23, 30), w), true);
  assert.equal(isEvening(at(6, 59), w), true);
  assert.equal(isEvening(at(7, 0), w), false);
});

test('isEvening 22:00 -> 06:00, disabled, start==end, same-day window', () => {
  const w = { enabled: true, start: '22:00', end: '06:00' };
  assert.equal(isEvening(at(21, 59), w), false);
  assert.equal(isEvening(at(22, 0), w), true);
  assert.equal(isEvening(at(5, 59), w), true);
  assert.equal(isEvening(at(6, 0), w), false);
  assert.equal(isEvening(at(23), { ...w, enabled: false }), false);
  assert.equal(isEvening(at(23), { enabled: true, start: '20:00', end: '20:00' }), false);
  const day = { enabled: true, start: '13:00', end: '15:00' };
  assert.equal(isEvening(at(14), day), true);
  assert.equal(isEvening(at(15), day), false);
});

test('store: missing, round trip, garbage, wrong types, throwing', () => {
  assert.equal(COLLECTION_KEY, 'collection.v1');
  assert.deepEqual(defaultCollection(), { version: 1, profile: null, avatar: null, pace: 'normal', evening: { enabled: false, start: '19:00', end: '07:00' }, ignored: {} });
  assert.deepEqual(loadCollection(fakeStorage()), defaultCollection());
  const s = fakeStorage();
  const c = { ...defaultCollection(), profile: { name: 'Léa', month: 3, year: 2020 }, pace: 'calme', ignored: { soir: 'off' } };
  assert.equal(saveCollection(s, c), true);
  assert.deepEqual(loadCollection(s), c);
  s.setItem(COLLECTION_KEY, '{oops');
  assert.deepEqual(loadCollection(s), defaultCollection());
  for (const bad of [
    { version: 2 }, null, 5, [], { version: 1, pace: 'turbo' },
    { version: 1, pace: 'calme', evening: 'x' },
    { version: 1, evening: { enabled: 'yes', start: '19:00', end: '07:00' } },
    { version: 1, evening: { enabled: true, start: '25:99', end: '07:00' } },
    { version: 1, ignored: [] }, { version: 1, ignored: { soir: 3 } },
    { version: 1, profile: { name: 'x', month: 13, year: 2020 } },
    { version: 1, profile: 'x' },
  ]) {
    s.setItem(COLLECTION_KEY, JSON.stringify(bad));
    const r = loadCollection(s);
    assert.ok(PACES.includes(r.pace));
    assert.equal(typeof r.evening.enabled, 'boolean');
    assert.equal(typeof r.ignored, 'object');
    assert.ok(!Array.isArray(r.ignored));
    assert.ok(r.profile === null || (r.profile.month >= 1 && r.profile.month <= 12));
    for (const v of Object.values(r.ignored)) assert.equal(typeof v, 'string');
  }
  assert.deepEqual(loadCollection(throwing), defaultCollection());
  assert.equal(saveCollection(throwing, c), false);
});

test('recommendations', () => {
  const now = new Date(2026, 10, 19, 12);
  let c = defaultCollection();
  let ids = recommendations(c, now).map(r => r.id);
  assert.deepEqual(ids, ['profil', 'soir']);
  assert.equal(recommendations(c, now)[0].signature, 'none');
  assert.equal(recommendations(c, now)[1].signature, 'off');

  c = { ...c, profile: { name: 'Léa', month: 3, year: 2020 } }; // age 6
  const r = recommendations(c, now).find(x => x.id === 'rythme');
  assert.ok(r);
  assert.equal(r.signature, '6');
  assert.match(r.text, /6 ans/);
  assert.match(r.text, /calme/);
  assert.ok(!recommendations(c, now).some(x => x.id === 'profil'));

  c = ignoreRecommendation(c, r);
  assert.ok(!recommendations(c, now).some(x => x.id === 'rythme'));
  const later = new Date(2027, 10, 19, 12); // age 7
  // at 7 with pace normal, normal is already recommended: nothing to show
  assert.ok(!recommendations(c, later).some(x => x.id === 'rythme'));
  // the parent chose calme meanwhile: at 7 the recommendation (normal) is new, so it comes back
  const calme = recommendations({ ...c, pace: 'calme' }, later).find(x => x.id === 'rythme');
  assert.ok(calme);
  assert.equal(calme.signature, '7');
  assert.match(calme.text, /normal/);
  // but at the same age 6 it stays hidden
  assert.ok(!recommendations(c, new Date(2026, 11, 1)).some(x => x.id === 'rythme'));

  const soir = recommendations(c, now).find(x => x.id === 'soir');
  c = ignoreRecommendation(c, soir);
  assert.ok(!recommendations(c, now).some(x => x.id === 'soir'));
});

test('applyRecommendation', () => {
  const now = new Date(2026, 10, 19, 12);
  const c = { ...defaultCollection(), profile: { name: 'Léa', month: 3, year: 2020 } };
  assert.equal(applyRecommendation(c, 'rythme', now).pace, 'calme');
  assert.deepEqual(applyRecommendation(c, 'soir', now).evening, { enabled: true, start: '19:00', end: '07:00' });
  assert.deepEqual(applyRecommendation(c, 'profil', now), c);
  assert.equal(c.pace, 'normal');
  assert.equal(c.evening.enabled, false);
});

test('effectiveSettings', () => {
  const c = { ...defaultCollection(), pace: 'rapide', evening: { enabled: true, start: '19:00', end: '07:00' } };
  const e = effectiveSettings(c, at(20));
  assert.equal(e.evening, true);
  assert.equal(e.pace, 'calme');
  assert.deepEqual(e.factors, PACE_FACTORS.calme);
  const d = effectiveSettings(c, at(12));
  assert.equal(d.evening, false);
  assert.equal(d.pace, 'rapide');
});
