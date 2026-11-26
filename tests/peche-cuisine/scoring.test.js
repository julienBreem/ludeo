import test from 'node:test';
import assert from 'node:assert/strict';
import { prepCoins, orderCoins, mood } from '../../jeux/peche-cuisine/src/logic/scoring.js';
import { ALL_COLORS, gameSetup } from '../../jeux/peche-cuisine/src/logic/setup.js';

test('prepCoins counts peche and pesee', () => {
  assert.equal(prepCoins({ peche: true, pesee: true }), 2);
  assert.equal(prepCoins({ peche: true, pesee: false }), 1);
  assert.equal(prepCoins({ peche: false, pesee: false }), 0);
});

test('orderCoins counts cuisine, decoupe and dressage', () => {
  assert.equal(orderCoins({ cuisine: true, decoupe: true, dressage: true }), 3);
  assert.equal(orderCoins({ cuisine: true, decoupe: false, dressage: true }), 2);
  assert.equal(orderCoins({ cuisine: false, decoupe: false, dressage: false }), 0);
});

test('mood 3/2/0', () => {
  assert.equal(mood(3), 'content');
  assert.equal(mood(2), 'bof');
  assert.equal(mood(1), 'bof');
  assert.equal(mood(0), 'fache');
});

test('gameSetup gives the starter values', () => {
  assert.deepEqual(ALL_COLORS, ['bleu', 'rouge', 'jaune', 'vert', 'violet', 'orange']);
  assert.deepEqual(gameSetup({}), { colors: ['bleu', 'rouge'], capacity: 8, pondSize: 4, rod: 'bambou', garnishes: ['citron', 'salade'] });
});
