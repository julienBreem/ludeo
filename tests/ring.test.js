import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ringSlots, ringCentre, SLOT_SIZE, MIN_SLOT_SIZE, MAX_RADIUS, SLOT_REACH } from '../jeux/stand-desserts/src/logic/ring.js';
import { ringPositions, RING_SLOTS } from '../jeux/stand-desserts/src/logic/order.js';
import { ITEMS } from '../jeux/stand-desserts/src/logic/catalog.js';

const GRID = 64;
const CELL = 400 / GRID;

// The game's real 64x64 masks (cakeView.js shapeMask of every shape-<shape>-fill texture, read in
// headless Chrome), one hex string of 16 digits per row (4 cells per digit, leftmost = high bit).
// Regenerate it if a shape's art changes.
const FIXTURE = JSON.parse(fs.readFileSync(new URL('./fixtures/shape-masks.json', import.meta.url), 'utf8'));
function decode(rows) {
  const m = new Uint8Array(GRID * GRID);
  rows.forEach((r, y) => [...r].forEach((h, i) => {
    const n = parseInt(h, 16);
    for (let b = 0; b < 4; b++) m[y * GRID + i * 4 + b] = (n >> (3 - b)) & 1;
  }));
  return m;
}
const REAL = Object.fromEntries(Object.entries(FIXTURE).map(([k, rows]) => [k, decode(rows)]));
// mirror-symmetric left / right silhouettes
const SYMMETRIC = ['rond', 'carre', 'coeur', 'triangle', 'rectangle', 'ovale', 'etoile', 'losange', 'hexagone'];

const synth = (fn) => {
  const m = new Uint8Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) m[y * GRID + x] = fn(x + 0.5, y + 0.5) ? 1 : 0;
  return m;
};
const SYNTH = {
  disc: synth((x, y) => Math.hypot(x - 32, y - 32) < 26),
  thinEllipse: synth((x, y) => ((x - 32) / 28) ** 2 + ((y - 32) / 12) ** 2 < 1),
  tallTriangle: synth((x, y) => y > 6 && y < 58 && Math.abs(x - 32) < (y - 6) * 0.45),
  plus: synth((x, y) => (Math.abs(x - 32) < 9 && Math.abs(y - 32) < 27) || (Math.abs(y - 32) < 9 && Math.abs(x - 32) < 27)),
  offCentre: synth((x, y) => Math.hypot(x - 20, y - 40) < 16),
};

const cellOf = p => [Math.floor((p.x + 200) / CELL), Math.floor((p.y + 200) / CELL)];
const isInside = (mask, p) => {
  const [u, v] = cellOf(p);
  return u >= 0 && v >= 0 && u < GRID && v < GRID && mask[v * GRID + u] === 1;
};

test('the fixture holds every catalog shape', () => {
  const shapes = ITEMS.filter(i => i.kind === 'shape').map(i => i.key).sort();
  assert.deepEqual(Object.keys(REAL).sort(), shapes);
});

test('every slot centre is inside the mask, for every real shape and synthetic mask, 6 and 8 slots', () => {
  for (const [name, mask] of [...Object.entries(REAL), ...Object.entries(SYNTH)]) {
    for (const n of [6, 7, 8]) {
      const { slots, size } = ringSlots(mask, n);
      assert.equal(slots.length, n, `${name}/${n}: ${slots.length} slots`);
      for (const p of slots) assert.ok(isInside(mask, p), `${name}/${n}: slot ${JSON.stringify(p)} outside the mask`);
      assert.ok(size >= MIN_SLOT_SIZE && size <= SLOT_SIZE, `${name}/${n}: size ${size}`);
    }
  }
});

test('real shapes: slots keep some room inside the outline and do not pile up', () => {
  for (const [name, mask] of Object.entries(REAL)) {
    for (const n of [6, 8]) {
      const { slots, centre } = ringSlots(mask, n);
      for (const p of slots) {
        // a few units around the centre are inside too (it is not on the outline itself)
        for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
          assert.ok(isInside(mask, { x: p.x + dx, y: p.y + dy }), `${name}/${n}: slot ${JSON.stringify(p)} too near the edge`);
        }
        assert.ok(Math.hypot(p.x - centre.x, p.y - centre.y) <= MAX_RADIUS + 0.5, `${name}/${n}: within the ring's radius`);
      }
      let gap = Infinity;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) gap = Math.min(gap, Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y));
      assert.ok(gap >= MIN_SLOT_SIZE, `${name}/${n}: closest slots ${gap.toFixed(1)} apart`);
    }
  }
  // the round and the square cake take the illustrator's full ring: slots of 80 that do not touch
  for (const name of ['rond', 'carre']) assert.equal(ringSlots(REAL[name], RING_SLOTS).size, SLOT_SIZE, name);
});

test('slot markers never touch, even the breathing one: size x SLOT_REACH <= the closest gap', () => {
  for (const [name, mask] of Object.entries(REAL)) {
    for (const n of [RING_SLOTS, 8]) {
      const { slots, size } = ringSlots(mask, n);
      let gap = Infinity;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) gap = Math.min(gap, Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y));
      assert.ok(size * SLOT_REACH <= gap + 1e-9, `${name}/${n}: size ${size}, gap ${gap.toFixed(1)}`);
    }
  }
});

test('symmetric shapes give a symmetric ring: slot k mirrors slot n-1-k about the centre line', () => {
  for (const name of SYMMETRIC) {
    for (const n of [6, 8]) {
      const { slots, centre } = ringSlots(REAL[name], n);
      assert.ok(Math.abs(centre.x) < 0.01, `${name}: centre on the axis (${centre.x})`);
      for (let k = 0; k < n; k++) {
        const a = slots[k];
        const b = slots[n - 1 - k];
        assert.ok(Math.abs(a.x + b.x) < 0.6 && Math.abs(a.y - b.y) < 0.6, `${name}/${n}: slot ${k} ${JSON.stringify(a)} / ${n - 1 - k} ${JSON.stringify(b)}`);
      }
    }
  }
});

test('clockwise from just right of the top', () => {
  for (const name of ['rond', 'etoile', 'triangle', 'coeur']) {
    const { slots, centre } = ringSlots(REAL[name], 8);
    assert.ok(slots[0].x > 0 && slots[0].y < centre.y, `${name}: first slot top right`);
    const ang = slots.map(p => Math.atan2(p.y - centre.y, p.x - centre.x));
    // the angle grows (screen y down = clockwise), with one wrap
    let wraps = 0;
    for (let i = 1; i < ang.length; i++) if (ang[i] < ang[i - 1]) wraps++;
    assert.ok(wraps <= 1, `${name}: clockwise`);
  }
});

test('a disc gives the plain circle of ringPositions', () => {
  const { slots } = ringSlots(SYNTH.disc, 8);
  const r = Math.hypot(slots[0].x, slots[0].y);
  const want = ringPositions(8, r);
  slots.forEach((p, i) => assert.ok(Math.hypot(p.x - want[i].x, p.y - want[i].y) < 3, `slot ${i}`));
});

test('ringCentre: the deepest point, on the axis of a symmetric mask', () => {
  const c = ringCentre(SYNTH.offCentre);
  assert.ok(Math.abs(c.u - 20) < 0.6 && Math.abs(c.v - 40) < 0.6, JSON.stringify(c));
  assert.equal(ringCentre(new Uint8Array(GRID * GRID)), null);
  assert.deepEqual(ringSlots(new Uint8Array(GRID * GRID), 8).slots, []);
});
