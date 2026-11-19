import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, defaultState, loadState, saveState, resetState } from '../src/logic/save.js';
import { starterOwned } from '../src/logic/catalog.js';

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
