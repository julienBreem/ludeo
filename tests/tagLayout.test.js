import test from 'node:test';
import assert from 'node:assert/strict';
import { placeRow, labelLayout, tagHitArea } from '../jeux/stand-desserts/src/logic/tagLayout.js';
import { makeRng } from '../jeux/stand-desserts/src/logic/rng.js';

const spans = (items, xs) => items.map((it, i) => [xs[i] - it.w / 2, xs[i] + it.w / 2]);

test('a single tag sits on its anchor, clamped into the row', () => {
  assert.deepEqual(placeRow([{ want: 50, w: 40 }], 0, 200), [50]);
  assert.deepEqual(placeRow([{ want: 5, w: 40 }], 0, 200), [20]);
  assert.deepEqual(placeRow([{ want: 199, w: 40 }], 0, 200), [180]);
});

test('random rows: no overlap, inside the bounds when they fit, anchor order kept', () => {
  const rng = makeRng(7);
  for (let n = 0; n < 2000; n++) {
    const count = 1 + Math.floor(rng() * 4);
    const items = Array.from({ length: count }, () => ({ want: rng() * 600 - 50, w: 60 + rng() * 160 }));
    const xs = placeRow(items, 0, 500, 12);
    const s = spans(items, xs);
    const total = items.reduce((a, it) => a + it.w, 0) + 12 * (count - 1);
    const byWant = items.map((_, i) => i).sort((a, b) => items[a].want - items[b].want || a - b);
    for (let k = 1; k < byWant.length; k++) {
      const a = s[byWant[k - 1]];
      const b = s[byWant[k]];
      assert.ok(b[0] >= a[1] + 12 - 1e-9, 'gap kept, order kept');
    }
    if (total < 500) for (const [l, r] of s) assert.ok(l >= -1e-9 && r <= 500 + 1e-9, 'inside');
    else assert.ok(Math.abs((s[byWant[0]][0] + s[byWant[count - 1]][1]) / 2 - 250) < 1e-6, 'centred overflow');
  }
});

test('tagHitArea: at least 96 px each way, centred on the tag (container top-left origin)', () => {
  assert.deepEqual(tagHitArea(120, 64), { x: 0, y: -16, w: 120, h: 96 });
  assert.deepEqual(tagHitArea(200, 100), { x: 0, y: 0, w: 200, h: 100 });
  assert.deepEqual(tagHitArea(80, 64), { x: -8, y: -16, w: 96, h: 96 });
});

test('N1 label tags: the 96 px hit areas of two tags never overlap', () => {
  const rng = makeRng(11);
  const tag = () => ({ w: 96 + Math.floor(rng() * 125), h: rng() < 0.8 ? 64 : 64 + Math.floor(rng() * 30) });
  for (let n = 0; n < 3000; n++) {
    // the cake's box at N1 (screen px around the picture centre): about 300 x 200 or more
    const bw = 260 + rng() * 120;
    const bh = 170 + rng() * 120;
    const bb = { left: -bw / 2, right: bw / 2, top: -bh / 2, bottom: bh / 2 };
    const inBox = () => ({ x: bb.left + rng() * bw, y: bb.top + rng() * bh });
    const shape = { ...tag(), want: inBox() };
    const toppings = Array.from({ length: Math.floor(rng() * 4) }, () => ({ ...tag(), want: inBox() }));
    const colours = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => ({ ...tag(), want: inBox() }));
    const at = labelLayout({ bb, shape, toppings, colours });
    const all = [[shape, at.shape], ...toppings.map((t, i) => [t, at.toppings[i]]), ...colours.map((t, i) => [t, at.colours[i]])];
    const rects = all.map(([t, c]) => {
      const a = tagHitArea(t.w, t.h);
      return { l: c.x - t.w / 2 + a.x, t: c.y - t.h / 2 + a.y, r: c.x - t.w / 2 + a.x + a.w, b: c.y - t.h / 2 + a.y + a.h };
    });
    for (const r of rects) assert.ok(r.b - r.t >= 96 && r.r - r.l >= 96);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
        assert.ok(!overlap, `hit areas ${i} and ${j} overlap: ${JSON.stringify([a, b])}`);
      }
    }
  }
});
