import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeDough, judgeShape, judgeBake, judgeColor, judgeToppings, scoreRound, STEPS } from '../src/logic/scoring.js';
import { bakeState } from '../src/logic/bake.js';
import { createRound } from '../src/logic/round.js';

const order = { dessert: 'gateau', shape: 'coeur', color: 'rose', topping: 'fraise', toppingCount: 3 };
test('dough exact + stirred is ok', () => assert.deepEqual(judgeDough({ oeuf: 2, farine: 1, sucre: 1, beurre: 1 }, 1, 'gateau'), { ok: true }));
test('dough intruder beats missing', () => assert.equal(judgeDough({ oeuf: 1, lait: 1 }, 1, 'gateau').reason, 'intrus'));
test('dough missing', () => assert.equal(judgeDough({ oeuf: 1, farine: 1, sucre: 1, beurre: 1 }, 1, 'gateau').reason, 'manque'));
test('dough too much', () => assert.equal(judgeDough({ oeuf: 3, farine: 1, sucre: 1, beurre: 1 }, 1, 'gateau').reason, 'trop'));
test('dough not stirred', () => assert.equal(judgeDough({ oeuf: 2, farine: 1, sucre: 1, beurre: 1 }, 0.99, 'gateau').reason, 'pas-melange'));
test('shape', () => {
  assert.deepEqual(judgeShape('coeur', order), { ok: true });
  assert.equal(judgeShape('rond', order).reason, 'mauvaise-forme');
});
test('bake thresholds', () => { assert.equal(bakeState(0.449), 'pale'); assert.equal(bakeState(0.45), 'dore'); assert.equal(bakeState(0.70), 'dore'); assert.equal(bakeState(0.701), 'brule'); });
test('judgeBake', () => {
  assert.equal(judgeBake(0.2).reason, 'pale');
  assert.deepEqual(judgeBake(0.5), { ok: true });
  assert.equal(judgeBake(0.9).reason, 'brule');
});
test('color ok at 0.85', () => assert.equal(judgeColor({ rose: 0.85 }, order).ok, true));
test('color wrong colour dominates', () => assert.equal(judgeColor({ rose: 0.2, violet: 0.7 }, order).reason, 'mauvaise-couleur'));
test('color under-covered', () => assert.equal(judgeColor({ rose: 0.6, violet: 0.1 }, order).reason, 'pas-couvert'));
test('toppings exact', () => assert.equal(judgeToppings(['fraise', 'fraise', 'fraise'], order).ok, true));
test('toppings wrong kind beats count', () => assert.equal(judgeToppings(['fraise', 'bougie'], order).reason, 'mauvais-topping'));
test('toppings too few / too many', () => { assert.equal(judgeToppings(['fraise'], order).reason, 'pas-assez'); assert.equal(judgeToppings(Array(4).fill('fraise'), order).reason, 'trop'); });
test('score and mood', () => {
  const mk = n => Object.fromEntries(STEPS.map((s, i) => [s, { ok: i < n }]));
  assert.deepEqual(scoreRound(mk(5)), { coins: 5, mood: 'content' });
  assert.equal(scoreRound(mk(4)).mood, 'bof');
  assert.deepEqual(scoreRound(mk(3)), { coins: 3, mood: 'bof' });
  assert.deepEqual(scoreRound(mk(2)), { coins: 2, mood: 'fache' });
  assert.deepEqual(scoreRound(mk(0)), { coins: 0, mood: 'fache' });
});
test('createRound starts empty', () => { const r = createRound(order); assert.equal(r.cake.dessert, 'gateau'); assert.deepEqual(r.cake.toppings, []); assert.deepEqual(r.results, {}); });
