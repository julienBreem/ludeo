import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../jeux/peche-cuisine/src/logic/rng.js';
import { SIZES, weightRange, maxWeight, drawWeight } from '../../jeux/peche-cuisine/src/logic/fish.js';

test('N1 ranges: petit 1, moyen 2-3, grand 4-5', () => {
  assert.deepEqual(weightRange('petit', 1), [1, 1]);
  assert.deepEqual(weightRange('moyen', 1), [2, 3]);
  assert.deepEqual(weightRange('grand', 1), [4, 5]);
  assert.equal(maxWeight(1), 5);
});

test('N2 and N3 ranges: petit 1-3, moyen 4-6, grand 7-10', () => {
  for (const l of [2, 3]) {
    assert.deepEqual(weightRange('petit', l), [1, 3]);
    assert.deepEqual(weightRange('moyen', l), [4, 6]);
    assert.deepEqual(weightRange('grand', l), [7, 10]);
    assert.equal(maxWeight(l), 10);
  }
});

test('SIZES lists the three categories; unknown level is treated as 1', () => {
  assert.deepEqual(SIZES, ['petit', 'moyen', 'grand']);
  assert.deepEqual(weightRange('grand', 99), [4, 5]);
  assert.equal(maxWeight(undefined), 5);
});

test('drawWeight stays in range, for every size and level', () => {
  const rng = makeRng(1);
  for (const level of [1, 2, 3]) {
    for (const size of SIZES) {
      const [min, max] = weightRange(size, level);
      for (let i = 0; i < 500; i++) {
        const w = drawWeight(size, level, [], rng);
        assert.ok(Number.isInteger(w) && w >= min && w <= max, `${size} N${level}: ${w}`);
      }
    }
  }
});

test('drawWeight prefers weights the colour does not have yet', () => {
  const rng = makeRng(1);
  const counts = {};
  for (let i = 0; i < 600; i++) {
    const w = drawWeight('moyen', 2, [4, 5], rng);
    counts[w] = (counts[w] || 0) + 1;
  }
  assert.ok(counts[6] > counts[4], `6:${counts[6]} vs 4:${counts[4]}`);
  assert.ok(counts[6] > counts[5], `6:${counts[6]} vs 5:${counts[5]}`);
});

test('drawWeight still draws a weight the colour has (not deterministic)', () => {
  const rng = makeRng(1);
  let seen4 = 0;
  for (let i = 0; i < 600; i++) {
    if (drawWeight('moyen', 2, [4, 5], rng) === 4) seen4++;
  }
  assert.ok(seen4 >= 1);
});
