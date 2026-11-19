import test from 'node:test';
import assert from 'node:assert/strict';
import { placeRow } from '../jeux/stand-desserts/src/logic/tagLayout.js';
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
