import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { getCollection, getEffective, onEffectiveChange, updateCollection, CHECK_MS } from '../../shared/runtime.js';
import { COLLECTION_KEY, defaultCollection } from '../../shared/store.js';

function memoryStorage() {
  const data = {};
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
  };
}

function withStorage(storage, fn) {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => storage });
  try {
    return fn();
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
  }
}

test('defaults without localStorage or when it throws', () => {
  withStorage(undefined, () => assert.deepEqual(getCollection(), defaultCollection()));
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
  try {
    assert.deepEqual(getCollection(), defaultCollection());
    assert.equal(getEffective(new Date(2026, 10, 19, 12)).pace, 'normal');
    assert.equal(updateCollection(c => ({ ...c, pace: 'calme' })).pace, 'calme');
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
  }
});

test('updateCollection saves under collection.v1 and getEffective reads it', () => {
  const s = memoryStorage();
  withStorage(s, () => {
    updateCollection(c => ({ ...c, pace: 'rapide', evening: { enabled: true, start: '19:00', end: '07:00' } }));
    assert.equal(JSON.parse(s.data[COLLECTION_KEY]).pace, 'rapide');
    assert.equal(getEffective(new Date(2026, 10, 19, 12)).pace, 'rapide');
    const night = getEffective(new Date(2026, 10, 19, 20));
    assert.equal(night.pace, 'calme');
    assert.equal(night.evening, true);
  });
});

test('onEffectiveChange calls back only when pace or evening changes, every 60 s', () => {
  const s = memoryStorage();
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    withStorage(s, () => {
      const seen = [];
      const stop = onEffectiveChange(e => seen.push(e.pace));
      mock.timers.tick(CHECK_MS);
      assert.deepEqual(seen, []);
      updateCollection(c => ({ ...c, pace: 'calme' }));
      mock.timers.tick(CHECK_MS - 1);
      assert.deepEqual(seen, []);
      mock.timers.tick(1);
      assert.deepEqual(seen, ['calme']);
      mock.timers.tick(CHECK_MS);
      assert.deepEqual(seen, ['calme']);
      stop();
      updateCollection(c => ({ ...c, pace: 'rapide' }));
      mock.timers.tick(CHECK_MS);
      assert.deepEqual(seen, ['calme']);
    });
  } finally {
    mock.timers.reset();
  }
});
