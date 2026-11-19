import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, toPour, pourCap, pourMax, grabLimit, fixedRecipe, MAX_TARGET, PREFILL_MAX, SMALL_MAX, MAX_POUR_TOTAL } from '../jeux/stand-desserts/src/logic/recipe.js';
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
const shown = disp => disp.n * (disp.times ?? 1);
const totalPour = r => Object.keys(r.target).reduce((a, k) => a + toPour(r, k), 0);
// the kinds that carry an exercise: sum, complement, doubled or big (> SMALL_MAX) digit
const isExercise = d => d.kind !== 'digit' || d.times === 2 || d.n > SMALL_MAX;

test('every level keeps the dessert ingredient kinds (intruders unchanged)', () => {
  for (const level of [1, 2, 3]) {
    all(level, (r, d) => {
      assert.deepEqual(Object.keys(r.target).sort(), kindsOf(d));
      assert.deepEqual(Object.keys(r.display).sort(), kindsOf(d));
    });
  }
});

test('N1 (spec 2 bis): dice 1..4, at most 8 to pour, nothing prefilled, never doubled', () => {
  const seen = new Set();
  let atMax = false;
  all(1, (r) => {
    assert.equal(r.double, false);
    assert.deepEqual(r.prefilled, {});
    for (const [k, n] of Object.entries(r.target)) {
      assert.ok(Number.isInteger(n) && n >= 1 && n <= 4, `${k}=${n}`);
      assert.deepEqual(r.display[k], { kind: 'dice', n });
      seen.add(n);
    }
    const t = totalPour(r);
    assert.ok(t <= 8, `N1 total ${t}`);
    if (t === 8) atMax = true;
  });
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4]);
  assert.ok(atMax, 'N1 reaches 8 sometimes');
  assert.equal(MAX_POUR_TOTAL[1], 8);
});

test('N2 (spec 2 bis): exactly one sum a + b <= 6 (a, b >= 1), the other kinds 1..3', () => {
  const sumsSeen = new Set();
  all(2, (r) => {
    assert.equal(r.double, false);
    assert.deepEqual(r.prefilled, {});
    const sums = Object.values(r.display).filter(x => x.kind === 'sum');
    assert.equal(sums.length, 1);
    for (const [k, disp] of Object.entries(r.display)) {
      assert.ok(['digit', 'sum'].includes(disp.kind));
      assert.equal(disp.times, undefined);
      assert.equal(r.target[k], disp.n);
      if (disp.kind === 'sum') {
        assert.ok(disp.a >= 1 && disp.b >= 1);
        assert.equal(disp.a + disp.b, disp.n);
        assert.ok(disp.n >= 2 && disp.n <= 6, `sum ${disp.n}`);
        sumsSeen.add(disp.n);
      } else assert.ok(disp.n >= 1 && disp.n <= SMALL_MAX, `${k}=${disp.n}`);
    }
  });
  assert.deepEqual([...sumsSeen].sort(), [2, 3, 4, 5, 6]);
});

test('N2-N3 workload (Ruling 6, spec 2 bis): 1-2 exercise kinds, the others 1..3, total to pour <= 10 / 12', () => {
  for (const level of [2, 3]) {
    let atMax = false;
    all(level, (r) => {
      const ex = Object.values(r.display).filter(isExercise);
      assert.ok(ex.length >= 1 && ex.length <= 2, `exercise kinds ${JSON.stringify(r.display)}`);
      for (const d of Object.values(r.display)) if (!isExercise(d)) assert.ok(d.n >= 1 && d.n <= SMALL_MAX);
      const t = totalPour(r);
      assert.ok(t <= MAX_POUR_TOTAL[level], `N${level} total to pour ${t}`);
      if (t === MAX_POUR_TOTAL[level]) atMax = true;
    });
    assert.ok(atMax, `N${level} reaches its bound sometimes`);
  }
  assert.equal(MAX_POUR_TOTAL[2], 10);
  assert.equal(MAX_POUR_TOTAL[3], 12);
});

test('N3 (spec 2 bis): one complement of total <= 10 with prefilled + to pour = target, never negative', () => {
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
    assert.ok(r.target[ck] <= 10, `complement total ${r.target[ck]}`);
    assert.ok(Object.values(r.display).filter(x => x.kind === 'sum').length <= 1);
    for (const [k, disp] of Object.entries(r.display)) {
      if (disp.kind === 'sum') {
        sums++;
        assert.ok(disp.a >= 1 && disp.b >= 1);
        assert.equal(disp.a + disp.b, disp.n);
        assert.ok(disp.n <= 6, `sum ${disp.n}`);
      } else assert.ok(['digit', 'complement'].includes(disp.kind));
      assert.equal(r.target[k], shown(disp), 'target = shown value (x2 on a doubled column)');
      assert.ok(r.target[k] >= 1 && r.target[k] <= MAX_TARGET, `${k}=${r.target[k]}`);
      const pour = toPour(r, k);
      assert.ok(pour >= 1 && pour <= pourMax(k), `pour ${k}=${pour}`);
    }
  });
  assert.ok(doubles > total * 0.2 && doubles < total * 0.5, `doubles ${doubles}/${total}`);
  assert.ok(sums > 0);
});

test('N3 ×2 (Ruling 5): exactly one doubled column, a plain digit 2..4; the complement and sums never doubled', () => {
  all(3, (r) => {
    const doubled = Object.entries(r.display).filter(([, d]) => d.times === 2);
    assert.equal(doubled.length, r.double ? 1 : 0);
    for (const [k, d] of doubled) {
      assert.equal(d.kind, 'digit');
      assert.ok(d.n >= 2 && d.n <= 4, `doubled ${d.n}`);
      assert.equal(r.target[k], 2 * d.n);
    }
    const [ck, cd] = Object.entries(r.display).find(([, d]) => d.kind === 'complement');
    assert.equal(cd.times, undefined);
    assert.equal(r.target[ck], cd.n, 'the complement shows the final total');
  });
});

test('board capacity: what to pour stays below a lane (at most 9 of a kind), so « trop » is always possible', () => {
  assert.equal(pourCap('oeuf'), 20);
  for (const k of ['farine', 'sucre', 'beurre', 'lait', 'chocolat']) assert.equal(pourCap(k), 10);
  for (const k of ['oeuf', 'farine']) assert.equal(pourMax(k), pourCap(k) - 1);
  assert.equal(MAX_TARGET, 10);
  for (const level of [1, 2, 3]) {
    all(level, (r) => {
      for (const k of Object.keys(r.target)) {
        assert.ok(toPour(r, k) <= 9 && toPour(r, k) < pourCap(k), `N${level} ${k} ${toPour(r, k)}`);
      }
    });
  }
});

test('multi-grab: the hand holds at most what the board can still take of that kind', () => {
  assert.equal(grabLimit('farine'), 10);
  assert.equal(grabLimit('farine', { farine: 7 }), 3);
  assert.equal(grabLimit('farine', { farine: 10 }), 0);
  assert.equal(grabLimit('oeuf', { oeuf: 4, farine: 9 }), 16);
  assert.equal(grabLimit('chocolat', { oeuf: 4 }), 10); // an intruder has its own lane
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
