import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeDough, judgeShape, judgeBake, judgeColor, judgeToppings, minZoneCoverage, COVERAGE_OK, bitesFor, scoreRound, STEPS } from '../jeux/stand-desserts/src/logic/scoring.js';
import { bakeState } from '../jeux/stand-desserts/src/logic/bake.js';
import { zoneMap } from '../jeux/stand-desserts/src/logic/zones.js';
import { createRound } from '../jeux/stand-desserts/src/logic/round.js';

const order = { dessert: 'gateau', shape: 'coeur', glaze: ['rose'], toppings: [{ key: 'fraise', count: 3 }] };
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
const KEYS = ['rose', 'violet', 'jaune'];
const SIZE = 20;
// 10-wide, 4-tall mask at columns 3..12, rows 0..3 -> zones 0 (x 3..7) and 1 (x 8..12).
const mask = new Uint8Array(SIZE * SIZE);
for (let y = 0; y < 4; y++) for (let x = 3; x <= 12; x++) mask[y * SIZE + x] = 1;
const zones2 = zoneMap(mask, SIZE, 2);
const paintZones = (left, right) => {
  const cells = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < cells.length; i++) if (zones2[i] === 0) cells[i] = left; else if (zones2[i] === 1) cells[i] = right;
  return cells;
};
test('two zones painted correctly -> ok', () => assert.deepEqual(judgeColor(paintZones(1, 2), KEYS, zones2, ['rose', 'violet']), { ok: true }));
test('right colours swapped -> mauvaise-couleur with zone 0', () =>
  assert.deepEqual(judgeColor(paintZones(2, 1), KEYS, zones2, ['rose', 'violet']), { ok: false, reason: 'mauvaise-couleur', zone: 0, color: 'violet' }));
test('one zone half painted -> pas-couvert with that zone', () => {
  const cells = paintZones(1, 2);
  let n = 0;
  for (let i = 0; i < cells.length; i++) if (zones2[i] === 1 && (n++ % 2)) cells[i] = 0;
  assert.deepEqual(judgeColor(cells, KEYS, zones2, ['rose', 'violet']), { ok: false, reason: 'pas-couvert', zone: 1 });
});
test('85% of a zone is enough, 84% is not', () => {
  const zones1 = zoneMap(mask, SIZE, 1);
  const total = 40; // 10 x 4
  const mk = painted => { const c = new Uint8Array(SIZE * SIZE); let n = 0; for (let i = 0; i < c.length && n < painted; i++) if (zones1[i] === 0) { c[i] = 1; n++; } return c; };
  assert.equal(judgeColor(mk(34), KEYS, zones1, ['rose']).ok, true);
  assert.equal(judgeColor(mk(33), KEYS, zones1, ['rose']).reason, 'pas-couvert');
  assert.equal(total, 40);
});
test('a zone with no cells is satisfied', () => {
  const cells = paintZones(1, 0);
  const zones3 = zoneMap(mask, SIZE, 3).map(z => (z === 1 ? -1 : z)); // middle band has no cells
  const all = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < all.length; i++) if (zones3[i] === 0) all[i] = 1; else if (zones3[i] === 2) all[i] = 3;
  assert.equal(judgeColor(all, KEYS, zones3, ['rose', 'violet', 'jaune']).ok, true);
  assert.equal(cells.length, SIZE * SIZE);
});
test('paint bar: the least-covered zone, in any colour', () => {
  // zone 0 fully painted (wrong colour even), zone 1 at 70 %: the bar follows zone 1
  const cells = paintZones(2, 0);
  let n = 0;
  for (let i = 0; i < cells.length; i++) if (zones2[i] === 1 && n < 14) { cells[i] = 3; n++; } // 14 of 20 cells
  assert.equal(minZoneCoverage(cells, zones2, 2), 0.7);
  assert.ok(minZoneCoverage(cells, zones2, 2) / COVERAGE_OK < 1, 'bar not full while a zone is at 70 %');
  assert.equal(minZoneCoverage(paintZones(1, 2), zones2, 2), 1);
  assert.equal(minZoneCoverage(paintZones(0, 0), zones2, 2), 0);
});
test('paint bar: zones with no cells are ignored', () => {
  const zones3 = zoneMap(mask, SIZE, 3).map(z => (z === 1 ? -1 : z));
  const all = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < all.length; i++) if (zones3[i] >= 0) all[i] = 1;
  assert.equal(minZoneCoverage(all, zones3, 3), 1);
});
const tops = [{ key: 'fraise', count: 2 }, { key: 'etoile', count: 3 }];
test('toppings exact -> ok', () => assert.equal(judgeToppings(['fraise', 'etoile', 'fraise', 'etoile', 'etoile'], tops).ok, true));
test('toppings extra kind -> mauvais-topping', () =>
  assert.deepEqual(judgeToppings(['fraise', 'fraise', 'etoile', 'etoile', 'etoile', 'bougie'], tops), { ok: false, reason: 'mauvais-topping', key: 'bougie' }));
test('toppings short -> pas-assez', () =>
  assert.deepEqual(judgeToppings(['fraise', 'etoile', 'etoile', 'etoile'], tops), { ok: false, reason: 'pas-assez', key: 'fraise' }));
test('toppings over -> trop', () =>
  assert.deepEqual(judgeToppings(['fraise', 'fraise', 'etoile', 'etoile', 'etoile', 'etoile'], tops), { ok: false, reason: 'trop', key: 'etoile' }));
test('bitesFor table', () => assert.deepEqual([0, 1, 2, 3, 4, 5].map(bitesFor), [0, 1, 1, 2, 3, 4]));
test('score and mood', () => {
  const mk = n => Object.fromEntries(STEPS.map((s, i) => [s, { ok: i < n }]));
  assert.deepEqual(scoreRound(mk(5)), { coins: 5, mood: 'content' });
  assert.equal(scoreRound(mk(4)).mood, 'bof');
  assert.deepEqual(scoreRound(mk(3)), { coins: 3, mood: 'bof' });
  assert.deepEqual(scoreRound(mk(2)), { coins: 2, mood: 'fache' });
  assert.deepEqual(scoreRound(mk(0)), { coins: 0, mood: 'fache' });
});
test('createRound starts empty', () => { const r = createRound(order); assert.equal(r.cake.dessert, 'gateau'); assert.deepEqual(r.cake.toppings, []); assert.deepEqual(r.results, {}); });
