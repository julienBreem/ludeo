import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_RULES, ORDERS_PER_ROUND, feasibleOrders, drawOrder, isExactCombination, suggestCombination } from '../../jeux/peche-cuisine/src/logic/orders.js';
import { usable, ofColor } from '../../jeux/peche-cuisine/src/logic/stock.js';
import { makeRng } from '../../jeux/peche-cuisine/src/logic/rng.js';

// Size consistent with the N2 ranges: petit 1-3, moyen 4-6, grand 7-10.
const f = (id, color, weight) => ({ id, color, size: weight <= 3 ? 'petit' : weight <= 6 ? 'moyen' : 'grand', weight });

test('rules and round size', () => {
  assert.deepEqual(ORDER_RULES, { 1: { max: 5, counts: [1, 2] }, 2: { max: 10, counts: [2] }, 3: { max: 12, counts: [2, 3] } });
  assert.equal(ORDERS_PER_ROUND, 2);
});

test('6 blue from blue 5 and 1 is feasible at N2', () => {
  const s = [f('a', 'bleu', 5), f('b', 'bleu', 1), f('c', 'bleu', 3)];
  assert.ok(feasibleOrders(s, 2, ['bleu'], [2]).some(o => o.plates === 6));
});

test('feasibleOrders returns distinct pairs, plates >= 1 and within the max', () => {
  const s = [f('a', 'bleu', 2), f('b', 'bleu', 2), f('c', 'bleu', 4), f('d', 'bleu', 9)];
  const orders = feasibleOrders(s, 2, ['bleu'], [2]);
  const keys = orders.map(o => `${o.color}:${o.plates}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(orders.map(o => o.plates).sort((x, y) => x - y), [4, 6]);
  assert.ok(orders.every(o => o.plates >= 1 && o.plates <= 10));
});

test('feasibleOrders only uses fish of the colour and the given counts', () => {
  const s = [f('a', 'bleu', 1), f('b', 'rouge', 2), f('c', 'bleu', 3)];
  assert.deepEqual(feasibleOrders(s, 2, ['bleu'], [2]), [{ color: 'bleu', plates: 4 }]);
  assert.deepEqual(feasibleOrders(s, 2, ['rouge'], [2]), []);
  assert.deepEqual(feasibleOrders(s, 2, ['bleu'], [3]), []);
});

test('every drawn order is within the level max and exactly achievable', () => {
  const colors = ['bleu', 'rouge', 'vert'];
  for (const level of [1, 2, 3]) {
    const rng = makeRng(100 + level);
    const maxW = level === 1 ? 5 : 10;
    for (let i = 0; i < 300; i++) {
      const n = 1 + Math.floor(rng() * 12);
      const stock = [];
      for (let k = 0; k < n; k++) stock.push(f(`f${k}`, colors[Math.floor(rng() * 3)], 1 + Math.floor(rng() * maxW)));
      const o = drawOrder(stock, level, colors, rng);
      if (o === null) {
        assert.equal(usable(stock, level).length, 0);
        continue;
      }
      assert.ok(o.plates >= 1 && o.plates <= ORDER_RULES[level].max);
      assert.ok(suggestCombination(stock, o, level).length > 0, 'achievable');
    }
  }
});

test('orders ignore fish above the level max', () => {
  const s = [f('a', 'bleu', 8), f('b', 'bleu', 1), f('c', 'rouge', 9)];
  const o = drawOrder(s, 1, ['bleu', 'rouge'], makeRng(3));
  assert.deepEqual(o, { color: 'bleu', plates: 1 });
});

test('falls back to a single fish when no pair fits', () => {
  const s = [f('a', 'bleu', 4)];
  assert.deepEqual(drawOrder(s, 2, ['bleu'], makeRng(1)), { color: 'bleu', plates: 4 });
});

test('drawOrder returns null when nothing is usable', () => {
  assert.equal(drawOrder([], 2, ['bleu'], makeRng(1)), null);
  assert.equal(drawOrder([f('a', 'bleu', 9)], 1, ['bleu'], makeRng(1)), null);
});

test('N3 never asks more than 12 plates', () => {
  const s = [f('a', 'bleu', 10), f('b', 'bleu', 10), f('c', 'bleu', 9), f('d', 'bleu', 9)];
  assert.deepEqual(feasibleOrders(s, 3, ['bleu'], [2, 3]), []);
  for (let seed = 0; seed < 50; seed++) {
    const o = drawOrder(s, 3, ['bleu'], makeRng(seed));
    assert.ok(o.plates <= 12);
  }
  const t = [f('a', 'bleu', 5), f('b', 'bleu', 5), f('c', 'bleu', 5), f('d', 'bleu', 10)];
  assert.ok(feasibleOrders(t, 3, ['bleu'], [2, 3]).every(o => o.plates <= 12));
});

test('isExactCombination: right colour and sum only', () => {
  const o = { color: 'bleu', plates: 6 };
  assert.equal(isExactCombination([f('a', 'bleu', 5), f('b', 'bleu', 1)], o), true);
  assert.equal(isExactCombination([f('a', 'bleu', 6)], o), true);
  assert.equal(isExactCombination([f('a', 'bleu', 2), f('b', 'bleu', 2), f('c', 'bleu', 2)], o), true);
  assert.equal(isExactCombination([f('a', 'rouge', 3), f('b', 'rouge', 3)], o), false);
  assert.equal(isExactCombination([f('a', 'bleu', 3), f('b', 'rouge', 3)], o), false);
  assert.equal(isExactCombination([f('a', 'bleu', 5)], o), false);
  assert.equal(isExactCombination([], o), false);
});

test('suggestCombination returns a combination that isExactCombination accepts', () => {
  const s = [f('a', 'bleu', 5), f('b', 'bleu', 1), f('c', 'bleu', 3), f('d', 'bleu', 3), f('e', 'rouge', 6)];
  const o = { color: 'bleu', plates: 6 };
  const combo = suggestCombination(s, o, 2);
  assert.ok(isExactCombination(combo, o));
  assert.equal(combo.length, 2);
  assert.ok(combo.every(x => ofColor(s, 'bleu').includes(x)));
  // N3 prefers 2 or 3 fish; a single fish is only used when nothing else fits.
  const single = suggestCombination([f('a', 'bleu', 6)], o, 2);
  assert.deepEqual(single.map(x => x.id), ['a']);
  assert.deepEqual(suggestCombination([f('a', 'bleu', 5)], o, 2), []);
  // Fish above the level max are never suggested.
  assert.deepEqual(suggestCombination([f('a', 'bleu', 8)], { color: 'bleu', plates: 8 }, 1), []);
});

test('drawOrder avoids repeating the previous order when it can', () => {
  const s = [f('a', 'bleu', 1), f('b', 'bleu', 2)];
  const prev = { color: 'bleu', plates: 1 };
  for (let seed = 0; seed < 60; seed++) {
    assert.notDeepEqual(drawOrder(s, 1, ['bleu'], makeRng(seed), prev), prev);
  }
  // Only one choice left: it is returned even if it equals previous.
  const one = [f('a', 'bleu', 4)];
  assert.deepEqual(drawOrder(one, 2, ['bleu'], makeRng(1), { color: 'bleu', plates: 4 }), { color: 'bleu', plates: 4 });
});

test('drawOrder is uniform enough over the feasible orders', () => {
  const s = [f('a', 'bleu', 1), f('b', 'bleu', 2), f('c', 'bleu', 3)];
  const rng = makeRng(9);
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(drawOrder(s, 2, ['bleu'], rng).plates);
  assert.deepEqual([...seen].sort(), ['3', '4', '5'].map(Number).sort());
});
