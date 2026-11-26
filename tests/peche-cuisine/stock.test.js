import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_STOCK, addFish, removeFish, releaseFish, ofColor, usable } from '../../jeux/peche-cuisine/src/logic/stock.js';

const f = (id, color, size, weight) => ({ id, color, size, weight });

test('addFish below capacity appends', () => {
  const stock = [f('a', 'bleu', 'petit', 1)];
  const r = addFish(stock, f('b', 'rouge', 'moyen', 3), 2);
  assert.equal(r.released, false);
  assert.deepEqual(r.stock.map((x) => x.id), ['a', 'b']);
  assert.equal(stock.length, 1);
});

test('addFish when full returns released: true and the same stock', () => {
  const stock = [f('a', 'bleu', 'petit', 1)];
  const r = addFish(stock, f('b', 'rouge', 'moyen', 3), 1);
  assert.equal(r.released, true);
  assert.deepEqual(r.stock, stock);
});

test('removeFish removes only the given ids', () => {
  const stock = [f('a', 'bleu', 'petit', 1), f('b', 'rouge', 'petit', 1), f('c', 'bleu', 'moyen', 3)];
  assert.deepEqual(removeFish(stock, ['a', 'c']).map((x) => x.id), ['b']);
  assert.equal(stock.length, 3);
  assert.deepEqual(releaseFish(stock, 'b').map((x) => x.id), ['a', 'c']);
});

test('ofColor keeps one colour', () => {
  const stock = [f('a', 'bleu', 'petit', 1), f('b', 'rouge', 'petit', 1)];
  assert.deepEqual(ofColor(stock, 'rouge').map((x) => x.id), ['b']);
});

test('usable drops fish heavier than the level max', () => {
  const stock = [f('a', 'bleu', 'grand', 8), f('b', 'bleu', 'petit', 1)];
  assert.deepEqual(usable(stock, 1).map((x) => x.id), ['b']);
  assert.deepEqual(usable(stock, 2).map((x) => x.id), ['a', 'b']);
});

test('STARTER_STOCK: two colours, a petit in each, every weight <= 5', () => {
  assert.equal(new Set(STARTER_STOCK.map((x) => x.color)).size, 2);
  for (const c of ['bleu', 'rouge']) assert.ok(STARTER_STOCK.some((x) => x.color === c && x.size === 'petit'));
  assert.ok(STARTER_STOCK.every((x) => x.weight <= 5));
  assert.equal(STARTER_STOCK.length, 4);
});
