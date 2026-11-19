import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, isTheme } from '../../shared/themes.js';
import { COLLECTION_KEY, defaultCollection, loadCollection, saveCollection } from '../../shared/store.js';
import { recommendedLevel, themeLevel, phaseLevel, setThemeLevel, setOverride } from '../../shared/difficulty.js';
import { recordResult, phaseProposal } from '../../shared/history.js';
import { recommendations, applyRecommendation, ignoreRecommendation } from '../../shared/recommendations.js';

function fakeStorage(initial) {
  const m = new Map();
  if (initial !== undefined) m.set(COLLECTION_KEY, typeof initial === 'string' ? initial : JSON.stringify(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } };
}
const now = new Date(2026, 10, 19);
const GAMES = [{ id: 'stand-desserts', name: 'Stand de desserts', phases: [
  { id: 'pate', name: 'Pâte', theme: 'nombres', levels: 3 },
  { id: 'moule', name: 'Moule', theme: 'geometrie', levels: 1 },
] }];
const PATE = GAMES[0].phases[0];
const record = (c, oks) => oks.reduce((acc, ok) => recordResult(acc, 'stand-desserts', 'pate', ok), c);
const withProfile = (month, year) => ({ ...defaultCollection(), profile: { name: 'Léa', month, year } });

test('themes', () => {
  assert.deepEqual(THEMES.map(t => t.id), ['lecture', 'nombres', 'geometrie', 'temps', 'couleurs-fractions', 'logique', 'monnaie']);
  for (const t of THEMES) {
    assert.ok(t.name.length > 0);
    assert.equal(t.levels.length, 3);
  }
  assert.ok(isTheme('nombres'));
  assert.ok(!isTheme('memoire'));
});

test('defaults and garbage load', () => {
  const d = defaultCollection();
  assert.deepEqual([d.levels, d.overrides, d.history], [{}, {}, {}]);
  // old save without the new fields
  assert.deepEqual(loadCollection(fakeStorage({ version: 1, pace: 'calme' })).levels, {});
  const garbage = loadCollection(fakeStorage({
    version: 1,
    levels: { nombres: 2, lecture: 4, memoire: 2, temps: 'x', logique: 1.5 },
    overrides: { 'a/b': 3, 'a/c': 0, nope: 2, 'a/d': '2' },
    history: { 'a/b': [true, false, 'x', true, true, true, true, false], 'a/c': 'no', 'zz': [true] },
  }));
  assert.deepEqual(garbage.levels, { nombres: 2 });
  assert.deepEqual(garbage.overrides, { 'a/b': 3 });
  assert.deepEqual(garbage.history, { 'a/b': [true, true, true, true, false] });
  for (const bad of [{ version: 1, levels: [1], overrides: 5, history: null }]) {
    const c = loadCollection(fakeStorage(bad));
    assert.deepEqual([c.levels, c.overrides, c.history], [{}, {}, {}]);
  }
  const s = fakeStorage();
  const c = setOverride(setThemeLevel(defaultCollection(), 'nombres', 2), 'stand-desserts', 'pate', 3);
  saveCollection(s, c);
  assert.deepEqual(loadCollection(s), c);
});

test('recommendedLevel', () => {
  assert.deepEqual([5, 6, 7, 8, 12, 3].map(recommendedLevel), [1, 1, 2, 3, 3, 1]);
});

test('themeLevel and phaseLevel: override beats theme', () => {
  let c = defaultCollection();
  assert.equal(themeLevel(c, 'nombres'), 1);
  assert.equal(phaseLevel(c, 'stand-desserts', PATE), 1);
  c = setThemeLevel(c, 'nombres', 2);
  assert.equal(phaseLevel(c, 'stand-desserts', PATE), 2);
  c = setOverride(c, 'stand-desserts', 'pate', 3);
  assert.equal(phaseLevel(c, 'stand-desserts', PATE), 3);
  c = setThemeLevel(c, 'nombres', 1); // override persists
  assert.equal(phaseLevel(c, 'stand-desserts', PATE), 3);
  c = setOverride(c, 'stand-desserts', 'pate', null);
  assert.equal(phaseLevel(c, 'stand-desserts', PATE), 1);
  assert.deepEqual(c.overrides, {});
  assert.equal(setThemeLevel(c, 'inconnu', 2), c);
});

test('recordResult keeps the last 5, newest last, and is pure', () => {
  const c0 = defaultCollection();
  const c = record(c0, [true, true, false, true, true, false, false]);
  assert.deepEqual(c.history['stand-desserts/pate'], [false, true, true, false, false]);
  assert.deepEqual(c0.history, {});
});

test('proposal: too hard at 3 failures in the last 4', () => {
  let c = setThemeLevel(defaultCollection(), 'nombres', 2);
  assert.equal(phaseProposal(record(c, [false, false, true, true]), 'stand-desserts', PATE), null);
  assert.deepEqual(phaseProposal(record(c, [false, false, false, true]), 'stand-desserts', PATE), { direction: 'down', to: 1 });
  // only the last 4 count
  assert.deepEqual(phaseProposal(record(c, [true, false, false, true, false]), 'stand-desserts', PATE), { direction: 'down', to: 1 });
  assert.equal(phaseProposal(record(c, [false, true, false, true, true]), 'stand-desserts', PATE), null);
  // bound 1
  assert.equal(phaseProposal(record(defaultCollection(), [false, false, false, false]), 'stand-desserts', PATE), null);
});

test('proposal: too easy at 5 successes in a row', () => {
  const c = setThemeLevel(defaultCollection(), 'nombres', 2);
  assert.equal(phaseProposal(record(c, [true, true, true, true]), 'stand-desserts', PATE), null);
  assert.deepEqual(phaseProposal(record(c, [true, true, true, true, true]), 'stand-desserts', PATE), { direction: 'up', to: 3 });
  assert.equal(phaseProposal(record(c, [false, true, true, true, true]), 'stand-desserts', PATE), null);
  // bound 3
  assert.equal(phaseProposal(record(setThemeLevel(defaultCollection(), 'nombres', 3), [true, true, true, true, true]), 'stand-desserts', PATE), null);
});

test('changing a level clears the affected history', () => {
  let c = record(defaultCollection(), [false, false, false]);
  c = recordResult(c, 'stand-desserts', 'moule', true);
  const cOver = setOverride(c, 'stand-desserts', 'pate', 2);
  assert.equal(cOver.history['stand-desserts/pate'], undefined);
  assert.deepEqual(cOver.history['stand-desserts/moule'], [true]);
  const cTheme = setThemeLevel(c, 'nombres', 2, GAMES);
  assert.equal(cTheme.history['stand-desserts/pate'], undefined);
  assert.deepEqual(cTheme.history['stand-desserts/moule'], [true]); // other theme untouched
});

test('theme level change clears history of phases of that theme only (no override)', () => {
  // an overridden phase keeps its history: its effective level did not change
  let c = setOverride(defaultCollection(), 'stand-desserts', 'pate', 2);
  c = record(c, [true, false]);
  c = setThemeLevel(c, 'nombres', 3, GAMES);
  assert.deepEqual(c.history['stand-desserts/pate'], [true, false]);
});

test('recommendations without games: no phase proposals', () => {
  const c = record(withProfile(3, 2020), [false, false, false, false]);
  assert.ok(!recommendations(c, now).some(r => r.id.startsWith('phase:')));
});

test('phase recommendation, apply and ignore', () => {
  let c = setThemeLevel(withProfile(11, 2019), 'nombres', 2); // age 7, recommended 2
  c = record(c, [false, false, false, true]);
  let recs = recommendations(c, now, GAMES);
  const rec = recs.find(r => r.id === 'phase:stand-desserts/pate');
  assert.equal(rec.signature, 'down1');
  assert.match(rec.text, /Stand de desserts/);
  assert.match(rec.text, /Pâte/);
  assert.match(rec.text, /1/);
  const applied = applyRecommendation(c, rec.id, now, GAMES);
  assert.equal(phaseLevel(applied, 'stand-desserts', PATE), 1);
  assert.equal(applied.overrides['stand-desserts/pate'], 1);
  assert.equal(applied.history['stand-desserts/pate'], undefined);
  assert.ok(!recommendations(applied, now, GAMES).some(r => r.id.startsWith('phase:')));
  const ignored = ignoreRecommendation(c, rec);
  assert.equal(ignored.history['stand-desserts/pate'], undefined);
  assert.ok(!recommendations(ignored, now, GAMES).some(r => r.id.startsWith('phase:')));
  // a new series brings it back
  const again = record(ignored, [false, false, false, false]);
  assert.ok(recommendations(again, now, GAMES).some(r => r.id === 'phase:stand-desserts/pate'));
});

test('phases with levels 1 never get proposals', () => {
  let c = withProfile(3, 2020);
  for (const ok of [false, false, false, false]) c = recordResult(c, 'stand-desserts', 'moule', ok);
  assert.ok(!recommendations(c, now, GAMES).some(r => r.id.startsWith('phase:')));
});

test('niveau recommendation: per theme, apply, reappears when age changes', () => {
  let c = withProfile(3, 2020); // age 6 -> 1: nothing to say
  assert.ok(!recommendations(c, now, GAMES).some(r => r.id.startsWith('niveau:')));
  const seven = new Date(2027, 10, 19); // age 7 -> 2
  let recs = recommendations(c, seven, GAMES).filter(r => r.id.startsWith('niveau:'));
  assert.equal(recs.length, THEMES.length);
  const rec = recs.find(r => r.id === 'niveau:nombres');
  assert.equal(rec.signature, '7');
  assert.match(rec.text, /7 ans/);
  const applied = applyRecommendation(c, 'niveau:nombres', seven, GAMES);
  assert.equal(themeLevel(applied, 'nombres'), 2);
  assert.equal(recommendations(applied, seven, GAMES).filter(r => r.id.startsWith('niveau:')).length, THEMES.length - 1);
  // ignore, then the age changes
  const ign = ignoreRecommendation(c, rec);
  assert.ok(!recommendations(ign, seven, GAMES).some(r => r.id === 'niveau:nombres'));
  const eight = new Date(2028, 10, 19);
  assert.ok(recommendations(ign, eight, GAMES).some(r => r.id === 'niveau:nombres'));
  // no profile: no niveau cards
  assert.ok(!recommendations(defaultCollection(), seven, GAMES).some(r => r.id.startsWith('niveau:')));
});
