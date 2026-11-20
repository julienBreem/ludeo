import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { clock, getCollection, getEffective, onEffectiveChange, updateCollection, CHECK_MS, phaseLevels, phaseWins, recordPhaseResult } from '../../shared/runtime.js';
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

test('clock: ?debug&now= overrides the time only when well formed; ?now= alone is ignored', () => {
  const real = Date.now();
  const withSearch = search => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'location');
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { search } });
    try { return clock(); } finally { if (desc) Object.defineProperty(globalThis, 'location', desc); else delete globalThis.location; }
  };
  const d = withSearch('?debug&now=2026-11-19T20:05');
  assert.equal(d.getHours(), 20);
  assert.equal(d.getMinutes(), 5);
  assert.equal(withSearch('?x=1&debug=1&now=2026-11-19T20%3A05').getHours(), 20); // ':' encoded by URLSearchParams
  assert.ok(Math.abs(withSearch('?now=2026-11-19T20:05').getTime() - real) < 5000); // no debug flag
  assert.ok(Math.abs(withSearch('').getTime() - real) < 5000);
  assert.ok(Math.abs(withSearch('?debug&now=garbage').getTime() - real) < 5000);
  assert.ok(Math.abs(clock().getTime() - real) < 5000); // no location at all
});

function withSearch(search, fn) {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { search } });
  try { return fn(); } finally { if (desc) Object.defineProperty(globalThis, 'location', desc); else delete globalThis.location; }
}

const ALL_ONE = { commande: 1, pate: 1, moule: 1, cuisson: 1, couleur: 1, toppings: 1, service: 1 };

test('phaseLevels: theme level, then the phase override', () => {
  withStorage(memoryStorage(), () => {
    assert.deepEqual(phaseLevels('stand-desserts'), ALL_ONE);
    updateCollection(c => ({ ...c, levels: { nombres: 2, lecture: 3, geometrie: 3, 'couleurs-fractions': 3, monnaie: 3 } }));
    assert.deepEqual(phaseLevels('stand-desserts'), { ...ALL_ONE, commande: 3, pate: 2, moule: 3, couleur: 3, service: 3 });
    updateCollection(c => ({ ...c, overrides: { 'stand-desserts/pate': 3, 'stand-desserts/moule': 2, 'stand-desserts/couleur': 2, 'stand-desserts/service': 2 } }));
    assert.deepEqual(phaseLevels('stand-desserts'), { ...ALL_ONE, commande: 3, pate: 3, moule: 2, couleur: 2, service: 2 });
    assert.deepEqual(phaseLevels('inconnu'), {});
  });
});

test('phaseLevels: ?debug&level= forces levels; ignored without the debug flag or when invalid', () => {
  withStorage(memoryStorage(), () => {
    assert.deepEqual(withSearch('?debug&level=pate:3,commande:2', () => phaseLevels('stand-desserts')), { ...ALL_ONE, pate: 3, commande: 2 });
    assert.deepEqual(withSearch('?debug=1&level=pate%3A2', () => phaseLevels('stand-desserts')).pate, 2);
    assert.deepEqual(withSearch('?level=pate:3', () => phaseLevels('stand-desserts')), ALL_ONE);
    assert.deepEqual(withSearch('?debug&level=pate:4,x:2,moule,cuisson:0', () => phaseLevels('stand-desserts')), ALL_ONE);
  });
});

test('recordPhaseResult saves results only for scored phases that have levels', () => {
  const s = memoryStorage();
  withStorage(s, () => {
    recordPhaseResult('stand-desserts', 'pate', false, 1);
    recordPhaseResult('stand-desserts', 'pate', true, 1);
    recordPhaseResult('stand-desserts', 'commande', false, 1); // no point of its own
    recordPhaseResult('stand-desserts', 'service', false, 1); // the cash step (monnaie)
    recordPhaseResult('stand-desserts', 'nope', false, 1);
    recordPhaseResult('inconnu', 'pate', false, 1);
    assert.deepEqual(getCollection().history, { 'stand-desserts/pate': [false, true], 'stand-desserts/service': [false] });
  });
});

test('recordPhaseResult (I1): only a round played at the stored level counts', () => {
  withStorage(memoryStorage(), () => {
    updateCollection(c => ({ ...c, levels: { nombres: 2 } }));
    // a ?debug&level= round: played at 3 while the parent set 2
    withSearch('?debug&level=pate:3', () => assert.equal(recordPhaseResult('stand-desserts', 'pate', false, 3), false));
    // no level kept (a round from before levels) or the round of the level the parent just changed
    assert.equal(recordPhaseResult('stand-desserts', 'pate', false, undefined), false);
    assert.equal(recordPhaseResult('stand-desserts', 'pate', false, 1), false);
    assert.equal(getCollection().history['stand-desserts/pate'], undefined);
    assert.equal(recordPhaseResult('stand-desserts', 'pate', false, 2), true);
    // the debug override does not change what the parent set
    withSearch('?debug&level=pate:3', () => assert.equal(recordPhaseResult('stand-desserts', 'pate', true, 2), true));
    assert.deepEqual(getCollection().history['stand-desserts/pate'], [false, true]);
  });
});

test('phaseWins: wins among the recent results of each phase, 0 without history', () => {
  withStorage(memoryStorage(), () => {
    assert.equal(phaseWins('stand-desserts').pate, 0);
    assert.deepEqual(Object.keys(phaseWins('stand-desserts')).sort(), Object.keys(phaseLevels('stand-desserts')).sort());
    for (const ok of [true, false, true, true]) recordPhaseResult('stand-desserts', 'pate', ok, 1);
    recordPhaseResult('stand-desserts', 'moule', false, 1);
    const w = phaseWins('stand-desserts');
    assert.equal(w.pate, 3);
    assert.equal(w.moule, 0);
    // only the last HISTORY_MAX results count
    for (let i = 0; i < 6; i++) recordPhaseResult('stand-desserts', 'moule', true, 1);
    assert.equal(phaseWins('stand-desserts').moule, 5);
    assert.deepEqual(phaseWins('inconnu'), {});
  });
});
