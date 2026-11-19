import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { STORAGE_KEY, defaultState, loadState, saveState, resetState, currentState, updateStored } from '../jeux/stand-desserts/src/logic/save.js';
import { starterOwned } from '../jeux/stand-desserts/src/logic/catalog.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
  };
}
const boom = () => { throw new Error('boom'); };
const throwingStorage = { getItem: boom, setItem: boom, removeItem: boom };

test('missing key -> default state', () => {
  assert.deepEqual(loadState(fakeStorage()), defaultState());
});

test('default state shape', () => {
  assert.deepEqual(defaultState(), { version: 1, coins: 0, owned: starterOwned() });
});

test('round trip', () => {
  const s = fakeStorage();
  const st = { ...defaultState(), coins: 7 };
  assert.equal(saveState(s, st), true);
  assert.deepEqual(loadState(s), st);
});

test('garbage JSON -> default', () => {
  const s = fakeStorage();
  s.setItem(STORAGE_KEY, '{oops');
  assert.deepEqual(loadState(s), defaultState());
});

test('wrong shape -> default', () => {
  const bad = [
    { version: 1, coins: '12', owned: starterOwned() },
    { version: 1, coins: 5, owned: null },
    { version: 2, coins: 5, owned: starterOwned() },
    null,
    [],
  ];
  for (const b of bad) {
    const s = fakeStorage();
    s.setItem(STORAGE_KEY, JSON.stringify(b));
    assert.deepEqual(loadState(s), defaultState());
  }
});

test('throwing or null storage never throws', () => {
  assert.deepEqual(loadState(throwingStorage), defaultState());
  assert.deepEqual(loadState(null), defaultState());
  assert.equal(saveState(throwingStorage, defaultState()), false);
  assert.equal(saveState(null, defaultState()), false);
  assert.deepEqual(resetState(throwingStorage), defaultState());
  assert.deepEqual(resetState(null), defaultState());
});

test('unknown ids dropped, missing starters re-added', () => {
  const s = fakeStorage();
  s.setItem(STORAGE_KEY, JSON.stringify({ version: 1, coins: 3, owned: ['shape:rond', 'foo:bar'] }));
  const st = loadState(s);
  assert.deepEqual([...st.owned].sort(), [...starterOwned()].sort());
  assert.equal(st.coins, 3);
});

test('purchased items survive load', () => {
  const s = fakeStorage();
  s.setItem(STORAGE_KEY, JSON.stringify({ version: 1, coins: 0, owned: ['topping:etoile'] }));
  assert.ok(loadState(s).owned.includes('topping:etoile'));
});

test('reset removes the key', () => {
  const s = fakeStorage();
  saveState(s, { ...defaultState(), coins: 4 });
  assert.deepEqual(resetState(s), defaultState());
  assert.equal(s.getItem(STORAGE_KEY), null);
});

// I1: a page restored by the back gesture still holds the old State in memory; the parent has
// reset the game meanwhile. Its next save must build on the reset, not on the stale copy.
test('a save after a reset builds on storage, not on a stale copy in memory', () => {
  const s = fakeStorage();
  const stale = { ...defaultState(), coins: 37 };
  saveState(s, stale);
  resetState(s); // the parent space, on the home
  const add2 = st => ({ ...st, coins: st.coins + 2 });
  const { state, saved } = updateStored(s, stale, add2);
  assert.equal(saved, true);
  assert.equal(state.coins, 2);
  assert.equal(loadState(s).coins, 2);
});

test('currentState reads storage first, memory only when storage is refused', () => {
  const s = fakeStorage();
  const mem = { ...defaultState(), coins: 9 };
  assert.deepEqual(currentState(s, mem), defaultState()); // stored nothing: the reset wins
  saveState(s, { ...defaultState(), coins: 4 });
  assert.equal(currentState(s, mem).coins, 4);
  assert.equal(currentState(null, mem).coins, 9);
  assert.deepEqual(currentState(null, null), defaultState());
});

test('updateStored without storage keeps going in memory', () => {
  const { state, saved } = updateStored(null, { ...defaultState(), coins: 3 }, st => ({ ...st, coins: st.coins + 1 }));
  assert.equal(state.coins, 4);
  assert.equal(saved, false);
});

test('the game reloads when the browser restores it from the back-forward cache', () => {
  const main = fs.readFileSync(new URL('../jeux/stand-desserts/src/main.js', import.meta.url), 'utf8');
  assert.match(main, /addEventListener\('pageshow', \(e\) => \{\s*if \(e\.persisted\) window\.location\.reload\(\);/);
});
