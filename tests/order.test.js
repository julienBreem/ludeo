import test from 'node:test';
import assert from 'node:assert/strict';
import { DESSERTS, ownedKeys, starterOwned } from '../src/logic/catalog.js';
import { makeRng } from '../src/logic/rng.js';
import { generateOrder } from '../src/logic/order.js';

test('starter set: 2000 orders only use owned items, counts 1..5, all values reached', () => {
  const rng = makeRng(1); const owned = starterOwned(); const seen = { dessert: new Set(), count: new Set() };
  for (let i = 0; i < 2000; i++) {
    const o = generateOrder(owned, rng);
    assert.ok(o.dessert in DESSERTS);
    assert.ok(ownedKeys(owned, 'shape').includes(o.shape));
    assert.ok(ownedKeys(owned, 'color').includes(o.color));
    assert.ok(ownedKeys(owned, 'topping').includes(o.topping));
    assert.ok(Number.isInteger(o.toppingCount) && o.toppingCount >= 1 && o.toppingCount <= 5);
    seen.dessert.add(o.dessert); seen.count.add(o.toppingCount);
  }
  assert.equal(seen.dessert.size, 3); assert.equal(seen.count.size, 5);
});

test('a purchased item starts appearing in orders', () => {
  const owned = [...starterOwned(), 'shape:etoile']; const rng = makeRng(2);
  assert.ok(Array.from({ length: 500 }, () => generateOrder(owned, rng)).some(o => o.shape === 'etoile'));
});

test('owning only deco extras never leaks deco into orders', () => {
  const owned = [...starterOwned(), 'deco:auvent']; const rng = makeRng(3);
  for (let i = 0; i < 500; i++) {
    const o = generateOrder(owned, rng);
    assert.ok(!Object.values(o).includes('auvent'));
  }
});
