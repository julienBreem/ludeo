import test from 'node:test';
import assert from 'node:assert/strict';
import { DESSERTS, ownedKeys, starterOwned } from '../src/logic/catalog.js';
import { makeRng } from '../src/logic/rng.js';
import { generateOrder, MAX_TOPPINGS } from '../src/logic/order.js';

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
