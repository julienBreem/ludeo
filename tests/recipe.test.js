import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, toPour, pourCap, fixedRecipe, MAX_TARGET, PREFILL_MAX } from '../jeux/stand-desserts/src/logic/recipe.js';
import { makeRng } from '../jeux/stand-desserts/src/logic/rng.js';
import { DESSERTS } from '../jeux/stand-desserts/src/logic/catalog.js';
import { judgeDough } from '../jeux/stand-desserts/src/logic/scoring.js';

const SEEDS = 3000;
const all = (level, fn) => {
  for (const dessert of Object.keys(DESSERTS)) {
    for (let seed = 1; seed <= SEEDS; seed++) fn(makeRecipe(dessert, level, makeRng(seed)), dessert, seed);
  }
};
const kindsOf = d => Object.keys(DESSERTS[d].recipe).sort();
const shown = (disp, double) => disp.n * (double ? 2 : 1);

test('every level keeps the dessert ingredient kinds (intruders unchanged)', () => {
  for (const level of [1, 2, 3]) {
    all(level, (r, d) => {
      assert.deepEqual(Object.keys(r.target).sort(), kindsOf(d));
      assert.deepEqual(Object.keys(r.display).sort(), kindsOf(d));
    });
  }
});

test('N1: dice 1..5, nothing prefilled, never doubled', () => {
  const seen = new Set();
  all(1, (r) => {
    assert.equal(r.double, false);
    assert.deepEqual(r.prefilled, {});
    for (const [k, n] of Object.entries(r.target)) {
      assert.ok(Number.isInteger(n) && n >= 1 && n <= 5, `${k}=${n}`);
      assert.deepEqual(r.display[k], { kind: 'dice', n });
      seen.add(n);
    }
  });
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5]);
});

test('N2: digits <= 10 and exactly one sum a + b (a, b >= 1)', () => {
  all(2, (r) => {
    assert.equal(r.double, false);
    assert.deepEqual(r.prefilled, {});
    const sums = Object.values(r.display).filter(x => x.kind === 'sum');
    assert.equal(sums.length, 1);
    for (const [k, disp] of Object.entries(r.display)) {
      assert.ok(['digit', 'sum'].includes(disp.kind));
      assert.equal(r.target[k], disp.n);
      assert.ok(disp.n >= 1 && disp.n <= 10, `${k}=${disp.n}`);
      if (disp.kind === 'sum') {
        assert.ok(disp.a >= 1 && disp.b >= 1);
        assert.equal(disp.a + disp.b, disp.n);
      }
    }
  });
});

test('N3: <= 20, one complement with prefilled + to pour = target, never negative', () => {
  let doubles = 0;
  let sums = 0;
  let total = 0;
  all(3, (r) => {
    total++;
    if (r.double) doubles++;
    const comps = Object.entries(r.display).filter(([, x]) => x.kind === 'complement');
    assert.equal(comps.length, 1);
    const [ck] = comps[0];
    assert.deepEqual(Object.keys(r.prefilled), [ck]);
    const p = r.prefilled[ck];
    assert.ok(Number.isInteger(p) && p >= 1 && p <= PREFILL_MAX, `prefilled ${p}`);
    assert.ok(r.target[ck] > p, 'target > prefilled');
    assert.equal(p + toPour(r, ck), r.target[ck]);
    assert.ok(Object.values(r.display).filter(x => x.kind === 'sum').length <= 1);
    for (const [k, disp] of Object.entries(r.display)) {
      if (disp.kind === 'sum') {
        sums++;
        assert.ok(disp.a >= 1 && disp.b >= 1);
        assert.equal(disp.a + disp.b, disp.n);
      } else assert.ok(['digit', 'complement'].includes(disp.kind));
      assert.equal(r.target[k], shown(disp, r.double), 'target = shown value (x2 when double)');
      assert.ok(r.target[k] >= 1 && r.target[k] <= MAX_TARGET, `${k}=${r.target[k]}`);
      const pour = toPour(r, k);
      assert.ok(pour >= 1 && pour <= pourCap(k), `pour ${k}=${pour}`);
    }
  });
  assert.ok(doubles > total * 0.2 && doubles < total * 0.5, `doubles ${doubles}/${total}`);
  assert.ok(sums > 0);
});

test('board capacity: a non-egg kind never needs more than 10 poured, eggs at most 20', () => {
  assert.equal(pourCap('oeuf'), 20);
  for (const k of ['farine', 'sucre', 'beurre', 'lait', 'chocolat']) assert.equal(pourCap(k), 10);
  let bigEggs = false;
  all(3, (r) => {
    for (const k of Object.keys(r.target)) {
      assert.ok(toPour(r, k) <= pourCap(k));
      if (k === 'oeuf' && toPour(r, k) > 10) bigEggs = true;
    }
  });
  assert.ok(bigEggs, 'eggs use the second box sometimes');
});

test('same seed, same recipe; other seeds vary', () => {
  for (const level of [1, 2, 3]) {
    for (const d of Object.keys(DESSERTS)) {
      for (let seed = 1; seed <= 50; seed++) {
        assert.deepEqual(makeRecipe(d, level, makeRng(seed)), makeRecipe(d, level, makeRng(seed)));
      }
      const distinct = new Set();
      for (let seed = 1; seed <= 50; seed++) distinct.add(JSON.stringify(makeRecipe(d, level, makeRng(seed))));
      assert.ok(distinct.size > 10);
    }
  }
});

test('fixedRecipe is the dessert recipe as dice', () => {
  const r = fixedRecipe('gateau');
  assert.deepEqual(r.target, DESSERTS.gateau.recipe);
  assert.deepEqual(r.prefilled, {});
  assert.deepEqual(r.display.oeuf, { kind: 'dice', n: 2 });
});

test('judgeDough against a generated target counts the prefilled ones', () => {
  const target = { oeuf: 7, farine: 3, sucre: 2 };
  const prefilled = { oeuf: 3 };
  assert.deepEqual(judgeDough({ oeuf: 4, farine: 3, sucre: 2 }, 1, 'tarte', target, prefilled), { ok: true });
  assert.equal(judgeDough({ oeuf: 7, farine: 3, sucre: 2 }, 1, 'tarte', target, prefilled).reason, 'trop');
  assert.equal(judgeDough({ oeuf: 3, farine: 3, sucre: 2 }, 1, 'tarte', target, prefilled).reason, 'manque');
  assert.equal(judgeDough({ oeuf: 4, farine: 3, sucre: 2, lait: 1 }, 1, 'tarte', target, prefilled).reason, 'intrus');
  assert.equal(judgeDough({ oeuf: 4, farine: 3, sucre: 2 }, 0.5, 'tarte', target, prefilled).reason, 'pas-melange');
  // the target replaces the dessert's own recipe (tarte has no eggs)
  assert.equal(judgeDough({ farine: 2, beurre: 1, sucre: 1 }, 1, 'tarte', target, prefilled).reason, 'intrus');
  // every generated recipe is ok when she pours exactly what is missing
  for (const level of [1, 2, 3]) {
    for (let seed = 1; seed <= 200; seed++) {
      const r = makeRecipe('gateau', level, makeRng(seed));
      const added = Object.fromEntries(Object.keys(r.target).map(k => [k, toPour(r, k)]));
      assert.deepEqual(judgeDough(added, 1, 'gateau', r.target, r.prefilled), { ok: true });
    }
  }
});
