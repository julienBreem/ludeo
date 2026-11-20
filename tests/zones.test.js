import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { zoneMap, zoneEdges, layoutToppings, bandOptions } from '../jeux/stand-desserts/src/logic/zones.js';

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

// Glaçage N3: equal-area bands (order.equalArea)
const G = 64;
const triMask = (() => {
  // a triangle pointing up: one cell wide at the top, the whole width at the bottom
  const m = new Uint8Array(G * G);
  for (let y = 4; y < 60; y++) for (let x = 0; x < G; x++) if (Math.abs(x + 0.5 - 32) < (y - 4) * 0.5 + 0.5) m[y * G + x] = 1;
  return m;
})();
const counts = (mask, size, n, opts) => {
  const z = zoneMap(mask, size, n, opts);
  const c = new Array(n).fill(0);
  for (const v of z) if (v >= 0) c[v]++;
  return c;
};
const columnMax = (mask, size) => {
  const cols = new Array(size).fill(0);
  mask.forEach((v, i) => { if (v) cols[i % size]++; });
  return Math.max(...cols);
};

test('equalArea on a triangle: every band holds 1/n of the cells within one column', () => {
  const total = triMask.reduce((a, b) => a + b, 0);
  const col = columnMax(triMask, G);
  for (const n of [2, 3, 4]) {
    const c = counts(triMask, G, n, { equalArea: true });
    for (const k of c) assert.ok(Math.abs(k - total / n) <= col, `n=${n}: ${c.join(' | ')} (column ${col})`);
    // equal widths would give the middle bands far more (the reason for equal areas)
    if (n === 4) {
      const w = counts(triMask, G, n);
      assert.ok(w[1] - w[0] > col, `equal widths: ${w.join(' | ')}`);
    }
  }
});

test('equalArea on the real masks (triangle, cœur and every shape): bands equal within one column', () => {
  const rowsOf = JSON.parse(fs.readFileSync(new URL('./fixtures/shape-masks.json', import.meta.url), 'utf8'));
  for (const [name, rows] of Object.entries(rowsOf)) {
    const m = new Uint8Array(G * G);
    rows.forEach((r, y) => [...r].forEach((h, i) => {
      for (let b = 0; b < 4; b++) m[y * G + i * 4 + b] = (parseInt(h, 16) >> (3 - b)) & 1;
    }));
    const total = m.reduce((a, b) => a + b, 0);
    const col = columnMax(m, G);
    for (const n of [2, 3, 4]) {
      const c = counts(m, G, n, { equalArea: true });
      for (const k of c) assert.ok(Math.abs(k - total / n) <= col, `${name} n=${n}: ${c.join(' | ')}`);
    }
  }
});

test('equalArea edges: integer, increasing, inside the silhouette; zoneMap cuts there', () => {
  for (const n of [2, 3, 4]) {
    const e = zoneEdges(triMask, G, n, { equalArea: true });
    assert.equal(e.length, n - 1);
    e.forEach((x, i) => {
      assert.ok(Number.isInteger(x));
      if (i) assert.ok(x > e[i - 1]);
    });
    const z = zoneMap(triMask, G, n, { equalArea: true });
    for (let i = 0; i < z.length; i++) {
      if (!triMask[i]) { assert.equal(z[i], -1); continue; }
      assert.equal(z[i], e.filter(x => i % G >= x).length);
    }
  }
  assert.deepEqual(zoneEdges(triMask, G, 1, { equalArea: true }), []);
});

test('equalArea on a rectangle matches equal widths; without it widths stay equal (N1-N2)', () => {
  const m = rectMask(2, 13, 3, 9); // 12 wide
  for (const n of [2, 3, 4]) {
    assert.deepEqual(zoneEdges(m, SIZE, n, { equalArea: true }), zoneEdges(m, SIZE, n));
    assert.deepEqual(Array.from(zoneMap(m, SIZE, n, { equalArea: true })), Array.from(zoneMap(m, SIZE, n)));
  }
  // default and equalArea: false are the equal-width cut, on any shape
  for (const n of [2, 3, 4]) {
    assert.deepEqual(Array.from(zoneMap(triMask, G, n, { equalArea: false })), Array.from(zoneMap(triMask, G, n)));
    const xs = [];
    triMask.forEach((v, i) => { if (v) xs.push(i % G); });
    const minX = Math.min(...xs);
    const width = Math.max(...xs) - minX + 1;
    const e = zoneEdges(triMask, G, n);
    for (let k = 1; k < n; k++) assert.ok(Math.abs(e[k - 1] - (minX + (width * k) / n)) < 1e-9, `${n}: ${e}`);
  }
  assert.deepEqual(bandOptions({ equalArea: true }), { equalArea: true });
  assert.deepEqual(bandOptions({}), { equalArea: false });
  assert.deepEqual(bandOptions(null), { equalArea: false });
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
