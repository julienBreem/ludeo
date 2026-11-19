import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INGREDIENTS, DESSERTS, ITEMS, starterOwned, ownedKeys, itemById } from '../jeux/stand-desserts/src/logic/catalog.js';
import { makeRng } from '../jeux/stand-desserts/src/logic/rng.js';

test('every recipe ingredient exists and each recipe leaves at least one intruder', () => {
  for (const d of Object.values(DESSERTS)) {
    for (const ing of Object.keys(d.recipe)) assert.ok(INGREDIENTS.includes(ing));
    assert.ok(INGREDIENTS.some(i => !(i in d.recipe)));
  }
});
test('starter set matches the spec', () => {
  const s = starterOwned();
  assert.deepEqual(ownedKeys(s, 'shape'), ['rond','carre','coeur','triangle','rectangle','ovale']);
  assert.deepEqual(ownedKeys(s, 'color'), ['rose','violet','jaune','blanc']);
  assert.deepEqual(ownedKeys(s, 'topping'), ['fraise','pepites','vermicelles','bougie']);
  assert.deepEqual(ownedKeys(s, 'deco'), []);
});
test('ids are unique and kind-prefixed', () => {
  const ids = ITEMS.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(itemById('topping:etoile').price, 8);
  assert.equal(itemById('shape:etoile').kind, 'shape');
});
test('cheapest shop item is 8 coins', () => {
  assert.equal(Math.min(...ITEMS.filter(i => i.price > 0).map(i => i.price)), 8);
});
test('rng is deterministic and in range', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 100; i++) { const x = a(); assert.equal(x, b()); assert.ok(x >= 0 && x < 1); }
});
