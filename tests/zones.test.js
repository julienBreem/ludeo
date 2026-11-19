import test from 'node:test';
import assert from 'node:assert/strict';
import { zoneMap, zoneEdges, layoutToppings } from '../src/logic/zones.js';

const SIZE = 20;
function rectMask(x0, x1, y0, y1) {
  const m = new Uint8Array(SIZE * SIZE);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * SIZE + x] = 1;
  return m;
}
function discMask(cx, cy, r) {
  const m = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) m[y * SIZE + x] = 1;
  return m;
}

test('zoneMap halves a 10-wide square', () => {
  const m = rectMask(3, 12, 2, 6); const z = zoneMap(m, SIZE, 2);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const want = !m[y * SIZE + x] ? -1 : x <= 7 ? 0 : 1;
    assert.equal(z[y * SIZE + x], want, `(${x},${y})`);
  }
});

test('zoneMap on n=1 is all 0 inside, -1 outside', () => {
  const m = discMask(10, 10, 6); const z = zoneMap(m, SIZE, 1);
  for (let i = 0; i < m.length; i++) assert.equal(z[i], m[i] ? 0 : -1);
});

test('zoneMap thirds use all three bands', () => {
  const z = zoneMap(rectMask(0, 8, 0, 0), SIZE, 3);
  assert.deepEqual(Array.from(z.slice(0, 9)), [0, 0, 0, 1, 1, 1, 2, 2, 2]);
});

test('zoneEdges returns n-1 boundaries', () => {
  const m = rectMask(3, 12, 2, 6);
  assert.deepEqual(zoneEdges(m, SIZE, 1), []);
  assert.deepEqual(zoneEdges(m, SIZE, 2), [8]);
  const e3 = zoneEdges(m, SIZE, 3);
  assert.equal(e3.length, 2);
  assert.ok(e3[0] > 3 && e3[0] < e3[1] && e3[1] < 13);
});

test('layoutToppings: 8 points inside a small disc mask, pairwise distance >= 4', () => {
  const m = discMask(10, 10, 7); const pts = layoutToppings(m, SIZE, 8, 4);
  assert.equal(pts.length, 8);
  for (const p of pts) assert.equal(m[Math.floor(p.v) * SIZE + Math.floor(p.u)], 1);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    assert.ok(Math.hypot(pts[i].u - pts[j].u, pts[i].v - pts[j].v) >= 4);
  }
});

test('layoutToppings reduces minDist when needed, and honours the default when it fits', () => {
  const small = discMask(10, 10, 4);
  assert.equal(layoutToppings(small, SIZE, 8).length, 8);
  const big = discMask(10, 10, 9); const pts = layoutToppings(big, SIZE, 3);
  assert.equal(pts.length, 3);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.hypot(pts[i].u - pts[j].u, pts[i].v - pts[j].v) >= 9);
});

test('layoutToppings is deterministic', () => {
  const m = discMask(10, 10, 7);
  assert.deepEqual(layoutToppings(m, SIZE, 6), layoutToppings(m, SIZE, 6));
});
