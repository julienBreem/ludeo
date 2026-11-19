import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMoldExercise } from '../jeux/stand-desserts/src/logic/moldExercise.js';
import { SHAPE_PROPS, clueHolds } from '../jeux/stand-desserts/src/logic/shapes.js';
import { cutTangram } from '../jeux/stand-desserts/src/logic/tangram.js';
import { ITEMS, itemById, starterOwned, ownedKeys } from '../jeux/stand-desserts/src/logic/catalog.js';
import { loadState, STORAGE_KEY } from '../jeux/stand-desserts/src/logic/save.js';
import { makeRng } from '../jeux/stand-desserts/src/logic/rng.js';
import { zoneMap, layoutToppings } from '../jeux/stand-desserts/src/logic/zones.js';

const SIZE = 64;
const price = k => itemById(`shape:${k}`).price;

test('catalog: new shapes, starters and prices', () => {
  for (const k of ['triangle', 'rectangle', 'ovale']) assert.equal(price(k), 0);
  assert.equal(price('losange'), 10);
  assert.equal(price('hexagone'), 14);
  assert.equal(price('etoile'), 8);
  assert.equal(price('licorne'), 16);
  const shapes = ITEMS.filter(i => i.kind === 'shape').map(i => i.key).sort();
  assert.deepEqual(shapes, Object.keys(SHAPE_PROPS).sort());
});

test('old save gains the new starters, keeps purchases and coins', () => {
  const store = { getItem: () => JSON.stringify({ version: 1, coins: 7, owned: ['shape:rond', 'shape:carre', 'shape:coeur', 'shape:etoile'] }) };
  const st = loadState(store);
  assert.equal(st.coins, 7);
  for (const k of ['triangle', 'rectangle', 'ovale', 'etoile']) assert.ok(st.owned.includes(`shape:${k}`), k);
  assert.ok(!st.owned.includes('shape:losange'));
  assert.ok(STORAGE_KEY);
});

const ownedSets = [
  ownedKeys(starterOwned(), 'shape'),
  Object.keys(SHAPE_PROPS),
  ['rond', 'carre', 'coeur'],
];

function mask(fn) {
  const m = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (fn(x + 0.5, y + 0.5)) m[y * SIZE + x] = 1;
  return m;
}
const triangleMask = mask((x, y) => y > 8 && y < 56 && Math.abs(x - 32) < (y - 8) * 0.6);
const losangeMask = mask((x, y) => Math.abs(x - 32) / 26 + Math.abs(y - 32) / 20 <= 1);
const rectMask = mask((x, y) => x > 6 && x < 58 && y > 16 && y < 48);
const hexMask = mask((x, y) => Math.abs(y - 32) < 24 && Math.abs(x - 32) + Math.abs(y - 32) / 2 < 30);

for (const level of [1, 2, 3]) {
  test(`level ${level}: 500 exercises are well formed`, () => {
    const rng = makeRng(42 + level);
    for (let i = 0; i < 500; i++) {
      const owned = ownedSets[i % ownedSets.length];
      const shape = owned[Math.floor(rng() * owned.length)];
      const ex = makeMoldExercise({ shape }, level, owned, rng);
      assert.equal(ex.choices.length, 4);
      assert.equal(new Set(ex.choices).size, 4);
      assert.ok(ex.choices.includes(shape));
      if (level === 2) {
        assert.ok(ex.clue);
        assert.ok(clueHolds(ex.clue, shape), `${shape} ${JSON.stringify(ex.clue)}`);
        for (const c of ex.choices) if (c !== shape) assert.ok(!clueHolds(ex.clue, c), `${c} vs ${JSON.stringify(ex.clue)}`);
      } else assert.equal(ex.clue, null);
      assert.equal(ex.pieces, null);
    }
  });
}

test('N1 offers the close distractor when owned', () => {
  const close = { rond: ['ovale'], ovale: ['rond'], carre: ['rectangle', 'losange'], rectangle: ['carre', 'losange'], losange: ['carre', 'rectangle'] };
  const owned = Object.keys(SHAPE_PROPS);
  const rng = makeRng(5);
  for (const [shape, list] of Object.entries(close)) for (let i = 0; i < 50; i++) {
    const ex = makeMoldExercise({ shape }, 1, owned, rng);
    assert.ok(ex.choices.some(c => list.includes(c)), shape);
  }
});

function check(maskIn, shape, parts) {
  const rng = makeRng(9);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const pieces = cutTangram(maskIn, SIZE, shape, rng);
    assert.ok(pieces && pieces.length >= 2 && pieces.length <= 3);
    if (!parts) assert.equal(pieces.length, 2);
    seen.add(pieces.length);
    const count = new Uint8Array(SIZE * SIZE);
    for (const p of pieces) {
      assert.ok([0, 90, 180, 270].includes(p.rotation));
      assert.ok(p.polygon.length >= 3);
      let a = 0;
      p.polygon.forEach((q, k) => { const r = p.polygon[(k + 1) % p.polygon.length]; a += q[0] * r[1] - r[0] * q[1]; });
      assert.equal(Math.abs(a) / 2, p.cells.length, 'polygon area = cells');
      for (const c of p.cells) count[c]++;
    }
    for (let c = 0; c < count.length; c++) assert.equal(count[c], maskIn[c], `cell ${c}`);
  }
  return seen;
}

test('tangram pieces partition the mask', () => {
  check(triangleMask, 'triangle', false);
  check(losangeMask, 'losange', false);
  assert.deepEqual([...check(rectMask, 'rectangle', true)].sort(), [2, 3]);
  assert.deepEqual([...check(hexMask, 'hexagone', true)].sort(), [2, 3]);
});

test('N3 exercise carries pieces when given a mask', () => {
  const ex = makeMoldExercise({ shape: 'rectangle' }, 3, Object.keys(SHAPE_PROPS), makeRng(1), { mask: rectMask, size: SIZE });
  assert.ok(ex.pieces.length >= 2);
  assert.equal(cutTangram(new Uint8Array(SIZE * SIZE), SIZE, 'carre'), null);
});

test('zones and toppings work on triangle and losange masks', () => {
  for (const m of [triangleMask, losangeMask]) {
    const z = zoneMap(m, SIZE, 3);
    for (let i = 0; i < m.length; i++) assert.equal(z[i] >= 0, m[i] === 1);
    for (const n of [1, 3, 4, 6]) {
      const pts = layoutToppings(m, SIZE, n);
      assert.equal(pts.length, n);
      for (const p of pts) assert.equal(m[Math.floor(p.v) * SIZE + Math.floor(p.u)], 1);
    }
  }
});
