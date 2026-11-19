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

// Triangle-like mask: column x (2..17) holds (x - 1) cells, so equal widths would give unequal areas.
function triangleMask() {
  const m = new Uint8Array(SIZE * SIZE);
  for (let x = 2; x <= 17; x++) for (let y = 0; y < x - 1; y++) m[y * SIZE + x] = 1;
  return m;
}
function zoneCounts(z, n) {
  const c = new Array(n).fill(0);
  for (const v of z) if (v >= 0) c[v]++;
  return c;
}
function columnCounts(m) {
  const c = new Array(SIZE).fill(0);
  for (let i = 0; i < m.length; i++) if (m[i]) c[i % SIZE]++;
  return c;
}

test('equal area equals equal width on a square mask', () => {
  for (const [x0, x1, n] of [[2, 13, 2], [2, 13, 3], [4, 15, 2], [1, 18, 3]]) {
    const m = rectMask(x0, x1, 3, 3 + (x1 - x0)); const z = zoneMap(m, SIZE, n);
    const width = x1 - x0 + 1;
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      assert.equal(z[i], Math.floor((((i % SIZE) - x0) * n) / width), `w=${width} n=${n} x=${i % SIZE}`);
    }
    const e = zoneEdges(m, SIZE, n);
    for (let k = 1; k < n; k++) assert.equal(e[k - 1], x0 + (width * k) / n);
  }
});

test('equal-area zones on a triangle-like mask are within one column of equal', () => {
  const m = triangleMask();
  const maxCol = Math.max(...columnCounts(m));
  const total = m.reduce((a, b) => a + b, 0);
  for (const n of [2, 3]) {
    const counts = zoneCounts(zoneMap(m, SIZE, n), n);
    assert.equal(counts.reduce((a, b) => a + b, 0), total);
    for (const c of counts) assert.ok(Math.abs(c - total / n) <= maxCol, `n=${n} counts ${counts}`);
    // the narrow end gets more columns than with equal widths
    const z = zoneMap(m, SIZE, n);
    assert.ok(z[0 * SIZE + 2 + Math.floor(16 / n)] === 0, `n=${n}: first band is wider than an equal-width band`);
  }
});

test('equal-area zones on an asymmetric mask are within one column of equal, every band used', () => {
  // a tall block on the left, a long low tail on the right
  const m = rectMask(2, 5, 0, 15); for (let x = 6; x <= 18; x++) for (let y = 12; y <= 15; y++) m[y * SIZE + x] = 1;
  const maxCol = Math.max(...columnCounts(m));
  const total = m.reduce((a, b) => a + b, 0);
  for (const n of [2, 3]) {
    const counts = zoneCounts(zoneMap(m, SIZE, n), n);
    for (const c of counts) assert.ok(c > 0 && Math.abs(c - total / n) <= maxCol, `n=${n} counts ${counts}`);
  }
});

test('zoneEdges follow the equal-area bands: each edge is the first column of the next zone', () => {
  const masks = [triangleMask(), discMask(10, 10, 8), rectMask(3, 12, 2, 6)];
  for (const m of masks) for (const n of [1, 2, 3]) {
    const z = zoneMap(m, SIZE, n); const e = zoneEdges(m, SIZE, n);
    assert.equal(e.length, n - 1);
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      const x = i % SIZE;
      assert.equal(z[i], e.filter(v => x >= v).length, `n=${n} x=${x}`);
    }
  }
});

test('layoutToppings: 6 points inside a small disc mask, pairwise distance >= 4', () => {
  const m = discMask(10, 10, 7); const pts = layoutToppings(m, SIZE, 6, 4);
  assert.equal(pts.length, 6);
  for (const p of pts) assert.equal(m[Math.floor(p.v) * SIZE + Math.floor(p.u)], 1);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    assert.ok(Math.hypot(pts[i].u - pts[j].u, pts[i].v - pts[j].v) >= 4);
  }
});

test('layoutToppings reduces minDist when needed, and honours the default when it fits', () => {
  const small = discMask(10, 10, 4);
  assert.equal(layoutToppings(small, SIZE, 6).length, 6);
  const big = discMask(10, 10, 9); const pts = layoutToppings(big, SIZE, 3);
  assert.equal(pts.length, 3);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.hypot(pts[i].u - pts[j].u, pts[i].v - pts[j].v) >= 9);
});

test('layoutToppings is deterministic', () => {
  const m = discMask(10, 10, 7);
  assert.deepEqual(layoutToppings(m, SIZE, 6), layoutToppings(m, SIZE, 6));
});

test('layoutToppings is symmetric on a symmetric mask: each point has a mirror within 1 cell or is on the axis', () => {
  const masks = [discMask(10, 10, 8), discMask(10, 10, 7), rectMask(3, 16, 4, 14), rectMask(2, 16, 4, 14)];
  for (const m of masks) {
    let minX = SIZE; let maxX = -1;
    for (let i = 0; i < m.length; i++) if (m[i]) { minX = Math.min(minX, i % SIZE); maxX = Math.max(maxX, i % SIZE); }
    const axis = (minX + maxX + 1) / 2;
    for (let n = 1; n <= 6; n++) {
      const pts = layoutToppings(m, SIZE, n);
      assert.equal(pts.length, n);
      for (const p of pts) {
        assert.equal(m[Math.floor(p.v) * SIZE + Math.floor(p.u)], 1);
        if (Math.abs(p.u - axis) <= 0.5) continue;
        const ok = pts.some(q => q !== p && Math.hypot(q.u - (2 * axis - p.u), q.v - p.v) <= 1);
        assert.ok(ok, `n=${n} point (${p.u},${p.v}) has no mirror`);
      }
      assert.ok(pts.filter(p => Math.abs(p.u - axis) <= 0.5).length <= 1);
    }
  }
});

test('layoutToppings: 6 points on a small disc stay inside with no overlap', () => {
  const m = discMask(10, 10, 5); const pts = layoutToppings(m, SIZE, 6, 4);
  assert.equal(pts.length, 6);
  for (const p of pts) assert.equal(m[Math.floor(p.v) * SIZE + Math.floor(p.u)], 1);
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) assert.ok(Math.hypot(pts[i].u - pts[j].u, pts[i].v - pts[j].v) > 0);
});

test('layoutToppings falls back to single points on an asymmetric mask', () => {
  const m = rectMask(2, 5, 2, 8); for (let y = 2; y <= 8; y++) for (let x = 6; x <= 16; x++) if (y < 4) m[y * SIZE + x] = 1;
  const pts = layoutToppings(m, SIZE, 5, 3);
  assert.equal(pts.length, 5);
  for (const p of pts) assert.equal(m[Math.floor(p.v) * SIZE + Math.floor(p.u)], 1);
});
