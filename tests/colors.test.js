import test from 'node:test';
import assert from 'node:assert/strict';
import { BASES, MIX, MELANGE, mix, obtainable, mixedColors, basesOf, recipeFor, RECIPES } from '../jeux/stand-desserts/src/logic/colors.js';

test('mixing table is exact and symmetric', () => {
  const t = [['rouge', 'blanc', 'rose'], ['rouge', 'bleu', 'violet'], ['bleu', 'jaune', 'vert'], ['rouge', 'jaune', 'orange'],
    ['bleu', 'blanc', 'bleuclair'], ['marron', 'blanc', 'beige'], ['noir', 'blanc', 'gris']];
  for (const [a, b, r] of t) { assert.equal(mix(a, b), r); assert.equal(mix(b, a), r); }
  assert.equal(Object.keys(MIX).length, 7);
});

test('mix: same colour stays, unknown or odd inputs give melange, never throw', () => {
  assert.equal(mix('rouge', 'rouge'), 'rouge');
  assert.equal(mix('jaune', 'blanc'), MELANGE);
  assert.equal(mix('rose', 'vert'), MELANGE);
  assert.equal(mix('melange', 'rouge'), MELANGE);
  assert.equal(mix(undefined, 'rouge'), MELANGE);
  assert.equal(mix('zzz', null), MELANGE);
});

test('mixing any two colours of every pot set is defined (results included)', () => {
  const all = [...obtainable([...BASES, 'marron', 'noir']), MELANGE, 'zzz'];
  for (const a of all) for (const b of all) {
    const r = mix(a, b);
    assert.equal(typeof r, 'string');
    assert.equal(mix(b, a), r);
  }
});

test('obtainable: bases, then single mixes of owned bases', () => {
  assert.deepEqual(obtainable(BASES), ['rouge', 'bleu', 'jaune', 'blanc', 'rose', 'violet', 'vert', 'orange', 'bleuclair']);
  assert.deepEqual(mixedColors(BASES), ['rose', 'violet', 'vert', 'orange', 'bleuclair']);
  assert.ok(obtainable([...BASES, 'marron']).includes('beige'));
  assert.ok(!obtainable([...BASES, 'marron']).includes('gris'));
  assert.ok(obtainable([...BASES, 'noir']).includes('gris'));
  assert.deepEqual(obtainable(['rouge', 'bleu']), ['rouge', 'bleu', 'violet']);
});

test('basesOf: four fixed bases plus bought marron / noir; recipeFor', () => {
  assert.deepEqual(basesOf(['color:rose']), BASES);
  assert.deepEqual(basesOf(['color:noir', 'color:marron']), [...BASES, 'marron', 'noir']);
  assert.deepEqual(recipeFor('rose'), ['rouge', 'blanc']);
  assert.equal(recipeFor('rouge'), null);
  for (const [r, [a, b]] of Object.entries(RECIPES)) assert.equal(mix(a, b), r);
});
