import test from 'node:test';
import assert from 'node:assert/strict';
import { DESSERTS, ownedKeys, starterOwned } from '../jeux/stand-desserts/src/logic/catalog.js';
import { makeRng } from '../jeux/stand-desserts/src/logic/rng.js';
import { generateOrder, MAX_TOPPINGS } from '../jeux/stand-desserts/src/logic/order.js';

test('2000 starter orders: owned only, distinct, sizes 1..3, total <= 6, all sizes reached', () => {
  const rng = makeRng(1); const owned = starterOwned();
  const seen = { dessert: new Set(), glaze: new Set(), kinds: new Set() };
  for (let i = 0; i < 2000; i++) {
    const o = generateOrder(owned, rng);
    assert.ok(o.dessert in DESSERTS);
    assert.ok(ownedKeys(owned, 'shape').includes(o.shape));
    assert.ok(o.glaze.length >= 1 && o.glaze.length <= 3);
    assert.equal(new Set(o.glaze).size, o.glaze.length);
    for (const c of o.glaze) assert.ok(ownedKeys(owned, 'color').includes(c));
    assert.ok(o.toppings.length >= 1 && o.toppings.length <= 3);
    assert.equal(new Set(o.toppings.map(t => t.key)).size, o.toppings.length);
    let sum = 0;
    for (const t of o.toppings) {
      assert.ok(ownedKeys(owned, 'topping').includes(t.key));
      assert.ok(Number.isInteger(t.count) && t.count >= 1 && t.count <= 4);
      sum += t.count;
    }
    assert.equal(MAX_TOPPINGS, 6);
    assert.ok(sum <= 6);
    seen.dessert.add(o.dessert); seen.glaze.add(o.glaze.length); seen.kinds.add(o.toppings.length);
  }
  assert.equal(seen.dessert.size, 3);
  assert.deepEqual([...seen.glaze].sort(), [1, 2, 3]);
  assert.deepEqual([...seen.kinds].sort(), [1, 2, 3]);
});

test('zone weights roughly 50/35/15', () => {
  const rng = makeRng(5); const owned = starterOwned(); const n = 10000; const c = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) c[generateOrder(owned, rng).glaze.length]++;
  [0.5, 0.35, 0.15].forEach((w, i) => assert.ok(Math.abs(c[i + 1] / n - w) < 0.03, `size ${i + 1}: ${c[i + 1] / n}`));
});

test('a purchased item starts appearing in orders', () => {
  const owned = [...starterOwned(), 'shape:etoile', 'color:bleu', 'topping:bonbon']; const rng = makeRng(2);
  const orders = Array.from({ length: 500 }, () => generateOrder(owned, rng));
  assert.ok(orders.some(o => o.shape === 'etoile'));
  assert.ok(orders.some(o => o.glaze.includes('bleu')));
  assert.ok(orders.some(o => o.toppings.some(t => t.key === 'bonbon')));
});

test('owning only deco extras never leaks deco into orders', () => {
  const owned = [...starterOwned(), 'deco:auvent']; const rng = makeRng(3);
  for (let i = 0; i < 500; i++) {
    const o = generateOrder(owned, rng);
    assert.ok(!JSON.stringify(o).includes('auvent'));
  }
});

test('with a single colour and topping owned, sizes cap at 1', () => {
  const o = generateOrder(['color:rose', 'topping:fraise', 'shape:rond'], makeRng(4));
  assert.deepEqual(o.glaze, ['rose']);
  assert.equal(o.toppings.length, 1);
});

test('parseOrderParam (debug order): valid, defaults, rejects unknown or malformed', async () => {
  const { parseOrderParam } = await import('../jeux/stand-desserts/src/logic/order.js');
  assert.deepEqual(parseOrderParam('licorne/rose-violet-jaune/fraise:2-bougie:1-chantilly:3'), {
    dessert: 'gateau', shape: 'licorne', glaze: ['rose', 'violet', 'jaune'],
    toppings: [{ key: 'fraise', count: 2 }, { key: 'bougie', count: 1 }, { key: 'chantilly', count: 3 }],
  });
  assert.equal(parseOrderParam('rond/rose/fraise:1/tarte').dessert, 'tarte');
  for (const bad of [null, '', 'rond', 'rond/rose', 'pentagone/rose/fraise:1', 'rond/noir/fraise:1', 'rond/rose-rose/fraise:1',
    'rond/rose/fraise:7', 'rond/rose/fraise', 'rond/rose/fraise:1-fraise:2', 'rond/rose/fraise:1/pizza', 'rond/rose/fraise:1/gateau/x',
    'rond/rose-violet-jaune-blanc/fraise:1', 'rond/rose/fraise:1-bougie:1-bonbon:1-etoile:1']) {
    assert.equal(parseOrderParam(bad), null, String(bad));
  }
});

// ---- Lot 3: level-aware glaze and toppings ----
import { obtainable, mixedColors, basesOf } from '../jeux/stand-desserts/src/logic/colors.js';
import { BAND_PATTERNS, solveHints, ringPositions } from '../jeux/stand-desserts/src/logic/order.js';

const STARTER = starterOwned();
const RICH = [...STARTER, 'color:marron', 'color:noir', 'topping:etoile', 'topping:bonbon', 'topping:chantilly'];
const BOTH = { couleur: 3, toppings: 3 };

test('level 1 (or no levels): glaze and toppings as before, mode counts', () => {
  const rng = makeRng(7);
  for (let i = 0; i < 500; i++) {
    const o = generateOrder(STARTER, rng, { couleur: 1, toppings: 1 });
    assert.deepEqual(o.glaze, o.glazeBands);
    assert.equal(new Set(o.glaze).size, o.glaze.length);
    for (const c of o.glaze) assert.ok(ownedKeys(STARTER, 'color').includes(c));
    assert.equal(o.toppingMode, 'counts');
    assert.ok(o.toppings.every(t => t.count <= 5));
    assert.ok(o.toppings.reduce((a, t) => a + t.count, 0) <= 6);
    assert.ok(!('motif' in o) && !('hintCard' in o));
  }
  assert.equal(generateOrder(STARTER, makeRng(1)).toppingMode, 'counts');
  assert.equal(generateOrder(STARTER, makeRng(1), { couleur: 9, toppings: 'x' }).toppingMode, 'counts');
});

test('N2-N3 glaze: every colour obtainable with owned bases, at least one mixed', () => {
  for (const owned of [STARTER, RICH]) {
    const bases = basesOf(owned);
    const ok = obtainable(bases);
    const mixed = mixedColors(bases);
    for (const level of [2, 3]) {
      const rng = makeRng(11 + level);
      for (let i = 0; i < 1000; i++) {
        const o = generateOrder(owned, rng, { couleur: level });
        assert.ok(o.glazeBands.every(c => ok.includes(c)), o.glazeBands.join());
        assert.ok(o.glazeBands.some(c => mixed.includes(c)));
        assert.deepEqual(o.glaze, o.glazeBands);
      }
    }
  }
});

test('N2 glaze: 1 to 3 distinct bands, all sizes reached', () => {
  const rng = makeRng(5); const sizes = new Set();
  for (let i = 0; i < 1000; i++) {
    const o = generateOrder(STARTER, rng, { couleur: 2 });
    assert.equal(new Set(o.glazeBands).size, o.glazeBands.length);
    sizes.add(o.glazeBands.length);
  }
  assert.deepEqual([...sizes].sort(), [1, 2, 3]);
});

test('N3 glaze: 3 or 4 bands, adjacent repeats only, every colour a valid fraction, a repeat always present', () => {
  const valid = { 3: [1 / 3, 2 / 3], 4: [1 / 4, 1 / 2, 3 / 4] };
  const rng = makeRng(21); const seenPatterns = new Set();
  for (let i = 0; i < 2000; i++) {
    const b = generateOrder(RICH, rng, { couleur: 3 }).glazeBands;
    assert.ok(b.length === 3 || b.length === 4);
    const runs = [];
    b.forEach((c, k) => { if (k === 0 || c !== b[k - 1]) runs.push({ c, n: 0 }); runs[runs.length - 1].n++; });
    assert.equal(new Set(runs.map(r => r.c)).size, runs.length, 'a colour must be one run');
    assert.ok(runs.length < b.length, 'at least one repeat');
    for (const r of runs) assert.ok(valid[b.length].some(f => Math.abs(f - r.n / b.length) < 1e-9), `${r.n}/${b.length}`);
    seenPatterns.add(runs.map(r => r.n).join(','));
  }
  assert.ok(seenPatterns.size >= 6);
  assert.ok(BAND_PATTERNS.length >= 6);
});

const minPeriod = seq => {
  for (let p = 1; p <= seq.length; p++) if (seq.every((v, i) => i + p >= seq.length || seq[i + p] === v)) return p;
  return seq.length;
};

test('N2 motif: unambiguous prefix, owned kinds, 6 or 8 slots, >= 2 blanks', () => {
  const rng = makeRng(31); const slotsSeen = new Set(); const periods = new Set();
  for (const owned of [STARTER, RICH]) {
    for (let i = 0; i < 1500; i++) {
      const o = generateOrder(owned, rng, { toppings: 2 });
      assert.equal(o.toppingMode, 'motif');
      const { slots, pattern, sequence, prefill } = o.motif;
      assert.ok(slots === 6 || slots === 8);
      assert.equal(sequence.length, slots);
      assert.ok(prefill >= 2 * pattern.length, 'two full periods');
      assert.ok(slots - prefill >= 2);
      for (const k of sequence) assert.ok(ownedKeys(owned, 'topping').includes(k));
      sequence.forEach((k, j) => assert.equal(k, pattern[j % pattern.length]));
      const prefix = sequence.slice(0, prefill);
      assert.equal(minPeriod(prefix), pattern.length, 'prefix reveals the period');
      assert.equal(new Set(pattern).size, new Set([...pattern]).size);
      // toppings = counts of the whole sequence
      assert.equal(o.toppings.reduce((a, t) => a + t.count, 0), slots);
      slotsSeen.add(slots); periods.add(pattern.join('') && pattern.length + ':' + new Set(pattern).size);
    }
  }
  assert.deepEqual([...slotsSeen].sort(), [6, 8]);
  assert.deepEqual([...periods].sort(), ['2:2', '3:2', '3:3']);
});

test('N3 hints: unique non-negative solution, total <= 8, minus only from >= 2, matches toppings', () => {
  const rng = makeRng(41); let minus = 0, plus = 0, same = 0;
  for (const owned of [STARTER, RICH]) {
    for (let i = 0; i < 3000; i++) {
      const o = generateOrder(owned, rng, { toppings: 3 });
      assert.equal(o.toppingMode, 'hints');
      const { hints, solution } = o.hintCard;
      assert.deepEqual(solveHints(hints), solution);
      assert.deepEqual(o.toppings, solution);
      const total = solution.reduce((a, t) => a + t.count, 0);
      assert.ok(total <= 8 && solution.every(t => t.count >= 1 && t.count <= 5));
      assert.equal(hints[0].rel, 'count');
      assert.equal(new Set(hints.map(h => h.key)).size, hints.length);
      for (const h of hints.slice(1)) {
        const base = solution.find(t => t.key === h.of).count;
        if (h.rel === 'minus') { minus++; assert.ok(base >= 2); }
        if (h.rel === 'plus') plus++;
        if (h.rel === 'same') same++;
      }
      // brute force: no other count vector satisfies the same equations
      const keys = hints.map(h => h.key);
      let solutions = 0;
      const rec = (i, got) => {
        if (i === keys.length) { solutions++; return; }
        const h = hints[i];
        const want = h.rel === 'count' ? h.count : got[h.of] + (h.rel === 'plus' ? 1 : h.rel === 'minus' ? -1 : 0);
        if (want >= 0) rec(i + 1, { ...got, [h.key]: want });
      };
      rec(0, {});
      assert.equal(solutions, 1);
    }
  }
  assert.ok(minus > 0 && plus > 0 && same > 0);
});

test('solveHints rejects ambiguous or negative cards', () => {
  assert.equal(solveHints([{ key: 'a', rel: 'count', count: 1 }, { key: 'b', rel: 'minus', of: 'a', n: 1 }]), null);
  assert.equal(solveHints([{ key: 'b', rel: 'plus', of: 'a', n: 1 }]), null);
  assert.equal(solveHints([{ key: 'a', rel: 'count', count: 2 }, { key: 'a', rel: 'count', count: 2 }]), null);
  assert.deepEqual(solveHints([{ key: 'a', rel: 'count', count: 3 }, { key: 'b', rel: 'plus', of: 'a', n: 1 }]),
    [{ key: 'a', count: 3 }, { key: 'b', count: 4 }]);
});

test('few owned toppings: falls back to counts, never crashes', () => {
  const o = generateOrder(['color:rose', 'topping:fraise', 'shape:rond'], makeRng(2), BOTH);
  assert.equal(o.toppingMode, 'counts');
  assert.ok(o.glazeBands.length >= 3);
});

test('ringPositions: n symmetric slots, distinct, around the centre', () => {
  for (const n of [6, 7, 8]) {
    const p = ringPositions(n);
    assert.equal(p.length, n);
    for (const a of p) {
      assert.ok(p.some(b => Math.abs(b.x + a.x) < 0.01 && Math.abs(b.y - a.y) < 0.01), `mirror of ${a.x},${a.y}`);
      assert.ok(Math.hypot(a.x, a.y) > 50 && Math.abs(a.x) < 200 && Math.abs(a.y) < 200);
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y) > 80);
  }
  assert.deepEqual(ringPositions(0), []);
});
