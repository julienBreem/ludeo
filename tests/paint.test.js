import test from 'node:test';
import assert from 'node:assert/strict';
import { maskFromAlpha, createPaintGrid, dominantColor, GRID, BRUSH_RADIUS } from '../jeux/stand-desserts/src/logic/paint.js';

test('constants', () => { assert.equal(GRID, 64); assert.equal(BRUSH_RADIUS, 4); });

test('mask from alpha', () => {
  const rgba = new Uint8ClampedArray([0,0,0,255, 0,0,0,0, 0,0,0,0, 0,0,0,255]);
  assert.deepEqual(Array.from(maskFromAlpha(rgba, 2, 2, 2)), [1, 0, 0, 1]);
});

test('painting a full square mask gives full coverage', () => {
  const g = createPaintGrid(new Uint8Array(64 * 64).fill(1));
  for (let u = 0; u < 64; u += 2) for (let v = 0; v < 64; v += 2) g.paint(u, v, 1);
  assert.equal(g.coverage(['rose']).rose, 1);
});

test('cells outside the mask are never painted or counted', () => {
  const mask = new Uint8Array(64 * 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) mask[y * 64 + x] = 1;
  const g = createPaintGrid(mask);
  for (let u = 0; u < 64; u += 2) for (let v = 0; v < 64; v += 2) g.paint(u, v, 1);
  assert.equal(g.coverage(['rose']).rose, 1);
  for (let i = 0; i < mask.length; i++) if (!mask[i]) assert.equal(g.cells[i], 0);
});

test('overpainting changes colour share', () => {
  const g = createPaintGrid(new Uint8Array(64 * 64).fill(1));
  for (let u = 0; u < 64; u += 2) for (let v = 0; v < 64; v += 2) g.paint(u, v, 1);
  for (let u = 0; u < 32; u += 2) for (let v = 0; v < 64; v += 2) g.paint(u, v, 2);
  const c = g.coverage(['rose', 'violet']);
  assert.ok(Math.abs(c.rose - 0.5) < 0.1, String(c.rose));
  assert.ok(Math.abs(c.violet - 0.5) < 0.1, String(c.violet));
  assert.ok(Math.abs(c.rose + c.violet - 1) < 1e-9);
});

test('clear resets', () => {
  const g = createPaintGrid(new Uint8Array(64 * 64).fill(1));
  g.paint(32, 32, 1);
  assert.ok(g.coverage(['rose']).rose > 0);
  g.clear();
  assert.equal(g.coverage(['rose']).rose, 0);
});

test('empty mask gives zero coverage, not NaN', () => {
  const g = createPaintGrid(new Uint8Array(64 * 64));
  g.paint(10, 10, 1);
  assert.equal(g.coverage(['rose']).rose, 0);
});

test('dominantColor: the colour painted on the most cells wins', () => {
  const keys = ['rose', 'violet', 'jaune'];
  // mostly yellow (3), some violet (2): the yellow pot, not the first key
  assert.equal(dominantColor(Uint8Array.from([0, 3, 3, 3, 2, 2, 0]), keys), 'jaune');
  assert.equal(dominantColor(Uint8Array.from([2, 2, 1]), keys), 'violet');
  assert.equal(dominantColor(Uint8Array.from([1, 0, 0]), keys), 'rose');
});

test('dominantColor: unpainted cells never win; nothing painted gives null', () => {
  assert.equal(dominantColor(Uint8Array.from([0, 0, 0, 0, 2]), ['rose', 'violet']), 'violet');
  assert.equal(dominantColor(new Uint8Array(10), ['rose']), null);
});
