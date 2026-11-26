import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, defaultState, loadState, saveState, resetState, currentState, updateStored, newFish } from '../../jeux/peche-cuisine/src/logic/save.js';
import { STARTER_STOCK } from '../../jeux/peche-cuisine/src/logic/stock.js';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
const boom = () => { throw new Error('boom'); };
const throwingStorage = { getItem: boom, setItem: boom, removeItem: boom };
const put = (s, data) => s.setItem(STORAGE_KEY, typeof data === 'string' ? data : JSON.stringify(data));
const fish = (id, over = {}) => ({ id, color: 'bleu', size: 'petit', weight: 1, ...over });
const base = (over = {}) => ({ ...defaultState(), ...over });

test('defaultState has the starter stock with ids f1..f4 and nextFishId 5', () => {
  const d = defaultState();
  assert.equal(STORAGE_KEY, 'pecheCuisine.v1');
  assert.equal(d.version, 1);
  assert.equal(d.coins, 0);
  assert.deepEqual(d.owned, []);
  assert.equal(d.nextFishId, 5);
  assert.deepEqual(d.stock.map((f) => f.id), ['f1', 'f2', 'f3', 'f4']);
  assert.deepEqual(d.stock.map(({ id, ...rest }) => rest), STARTER_STOCK);
});

test('defaultState does not share mutable data between calls', () => {
  const a = defaultState();
  a.stock[0].weight = 9;
  a.owned.push('x');
  assert.deepEqual(defaultState(), defaultState());
  assert.equal(defaultState().stock[0].weight, 1);
});

test('loadState returns defaults for a missing key, bad JSON, wrong version', () => {
  assert.deepEqual(loadState(fakeStorage()), defaultState());
  const s = fakeStorage();
  put(s, '{oops');
  assert.deepEqual(loadState(s), defaultState());
  for (const bad of [null, [], base({ version: 2 }), base({ coins: '3' }), base({ coins: -1 }), base({ coins: 1.5 }), base({ owned: null }), base({ owned: [1] }), base({ stock: null })]) {
    const st = fakeStorage();
    put(st, bad);
    assert.deepEqual(loadState(st), defaultState());
  }
});

test('loadState returns defaults for a bad fish', () => {
  const bads = [
    fish('f1', { color: 'rose' }),
    fish('f1', { size: 'geant' }),
    fish('f1', { weight: 0 }),
    fish('f1', { weight: 11 }),
    fish('f1', { weight: 2.5 }),
    fish('f1', { id: 7 }),
    fish('x1'),
    fish('f'),
  ];
  for (const b of bads) {
    const s = fakeStorage();
    put(s, base({ stock: [b], nextFishId: 5 }));
    assert.deepEqual(loadState(s), defaultState());
  }
  const s = fakeStorage();
  put(s, base({ stock: [fish('f1'), fish('f1')], nextFishId: 5 }));
  assert.deepEqual(loadState(s), defaultState());
});

test('loadState returns defaults for a stale nextFishId', () => {
  for (const next of [3, 4, '5', 5.5, undefined, 0]) {
    const s = fakeStorage();
    put(s, { ...base({ stock: [fish('f3'), fish('f4')] }), nextFishId: next });
    assert.deepEqual(loadState(s), defaultState());
  }
  const s = fakeStorage();
  put(s, { ...base({ stock: [fish('f3'), fish('f4')] }), nextFishId: 5 });
  assert.equal(loadState(s).nextFishId, 5);
});

test('loadState with a throwing or null storage returns defaults', () => {
  assert.deepEqual(loadState(throwingStorage), defaultState());
  assert.deepEqual(loadState(null), defaultState());
  assert.equal(saveState(throwingStorage, defaultState()), false);
  assert.equal(saveState(null, defaultState()), false);
  assert.deepEqual(resetState(throwingStorage), defaultState());
  assert.deepEqual(resetState(null), defaultState());
});

test('save then load round-trips coins, owned and stock', () => {
  const s = fakeStorage();
  const st = { version: 1, coins: 12, owned: ['a', 'b'], stock: [fish('f2', { color: 'vert', size: 'grand', weight: 10 })], nextFishId: 9 };
  assert.equal(saveState(s, st), true);
  assert.deepEqual(loadState(s), st);
});

test('resetState removes only pecheCuisine.v1', () => {
  const s = fakeStorage();
  s.setItem('standDesserts.v1', 'keep');
  saveState(s, base({ coins: 4 }));
  assert.deepEqual(resetState(s), defaultState());
  assert.equal(s.getItem(STORAGE_KEY), null);
  assert.equal(s.getItem('standDesserts.v1'), 'keep');
  assert.deepEqual(resetState({ removeItem: (k) => s.removeItem(k) }), defaultState());
});

test('currentState and updateStored', () => {
  const mem = base({ coins: 9 });
  assert.equal(currentState(null, mem).coins, 9);
  assert.deepEqual(currentState(null, undefined), defaultState());
  const s = fakeStorage();
  saveState(s, base({ coins: 2 }));
  assert.equal(currentState(s, mem).coins, 2);
  const r = updateStored(s, null, (st) => ({ ...st, coins: st.coins + 3 }));
  assert.equal(r.saved, true);
  assert.equal(loadState(s).coins, 5);
  const r2 = updateStored(null, mem, (st) => ({ ...st, coins: 1 }));
  assert.deepEqual([r2.state.coins, r2.saved], [1, false]);
});

test('newFish gives f5 then f6 and does not touch the stock', () => {
  const s0 = defaultState();
  const a = newFish(s0, { color: 'bleu', size: 'grand' }, 6);
  assert.deepEqual(a.fish, { id: 'f5', color: 'bleu', size: 'grand', weight: 6 });
  assert.equal(a.state.nextFishId, 6);
  assert.equal(a.state.stock.length, 4);
  assert.equal(s0.nextFishId, 5);
  const b = newFish(a.state, { color: 'rouge', size: 'petit' }, 1);
  assert.equal(b.fish.id, 'f6');
  assert.equal(b.state.nextFishId, 7);
});

test('owned is kept as given when it is an array of strings', () => {
  const s = fakeStorage();
  put(s, base({ owned: ['canne:x'] }));
  assert.deepEqual(loadState(s).owned, ['canne:x']);
});
