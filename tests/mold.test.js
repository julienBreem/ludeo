import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMoldExercise } from '../jeux/stand-desserts/src/logic/moldExercise.js';
import { SHAPE_PROPS, clueHolds, cluesFor, cluePict, clueWord, FUN_PICT } from '../jeux/stand-desserts/src/logic/shapes.js';
import { CLOSE } from '../jeux/stand-desserts/src/logic/moldExercise.js';
import { cutTangram, cutSide, pieceFits, pieceMasks } from '../jeux/stand-desserts/src/logic/tangram.js';
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
const triangleP = (x, y) => y > 8 && y < 56 && Math.abs(x - 32) < (y - 8) * 0.6;
const losangeP = (x, y) => Math.abs(x - 32) / 26 + Math.abs(y - 32) / 20 <= 1;
const rectP = (x, y) => x > 6 && x < 58 && y > 16 && y < 48;
const hexP = (x, y) => Math.abs(y - 32) < 24 && Math.abs(x - 32) + Math.abs(y - 32) / 2 < 30;
// a rectangle with rounded corners (radius 6 cells), like the art's
const roundRectP = (x, y) => {
  if (!rectP(x, y)) return false;
  const cx = Math.min(Math.max(x, 12), 52), cy = Math.min(Math.max(y, 22), 42);
  return Math.hypot(x - cx, y - cy) <= 6;
};
const triangleMask = mask(triangleP);
const losangeMask = mask(losangeP);
const rectMask = mask(rectP);
const hexMask = mask(hexP);
const roundRectMask = mask(roundRectP);

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

test('N1 offers a close distractor for every shape, when owned', () => {
  const owned = Object.keys(SHAPE_PROPS);
  const rng = makeRng(5);
  for (const shape of owned) {
    assert.ok(CLOSE[shape]?.length, `${shape} has a close trap`);
    for (let i = 0; i < 50; i++) {
      const ex = makeMoldExercise({ shape }, 1, owned, rng);
      assert.ok(ex.choices.some(c => CLOSE[shape].includes(c)), shape);
    }
  }
});

// What a child sees on each outline, written apart from shapes.js: corners, sides, equal sides,
// sharp tips (corners, the heart's tip, the star's points, the horn), rounded bumps, star branches,
// a horn. A clue must be true of the target and false of every other mould shown.
const SEEN = {
  rond: {}, ovale: {},
  triangle: { coins: 3, cotes: 3, pointes: 3 },
  carre: { coins: 4, cotes: 4, pointes: 4, pareils: true },
  rectangle: { coins: 4, cotes: 4, pointes: 4 },
  losange: { coins: 4, cotes: 4, pointes: 4, pareils: true },
  hexagone: { coins: 6, cotes: 6, pointes: 6, pareils: true },
  coeur: { pointes: 1, bosses: 2 },
  etoile: { pointes: 5, branches: 5 },
  licorne: { pointes: 1, corne: 1, bosses: 5 },
};
function childReads(clue, shape) {
  const s = SEEN[shape];
  switch (clue.kind) {
    case 'corners': return s.coins === clue.n;
    case 'sides': return s.cotes === clue.n;
    case 'equalSides': return s.cotes === clue.n && !!s.pareils;
    case 'noCorner': return !s.pointes;
    case 'fun':
      if (clue.fun === 'bosses') return (s.bosses ?? 0) > 0; // any bumps could be « des bosses »
      if (clue.fun === 'branches') return s.branches === clue.n || s.pointes === clue.n;
      if (clue.fun === 'corne') return (s.corne ?? 0) > 0;
      return true;
    default: return true;
  }
}

// Every owned set the game can have: the starters plus any of the shop's shapes.
const SHOP = ['etoile', 'licorne', 'losange', 'hexagone'];
const STARTERS = ownedKeys(starterOwned(), 'shape');
const everyOwnedSet = [];
for (let m = 0; m < 1 << SHOP.length; m++) everyOwnedSet.push([...STARTERS, ...SHOP.filter((_, i) => m & (1 << i))]);

test('N2: over every owned set, the clue is true of the target only among the moulds shown', () => {
  assert.equal(everyOwnedSet.length, 16);
  const rng = makeRng(77);
  for (const owned of everyOwnedSet) {
    for (const shape of owned) {
      for (let i = 0; i < 40; i++) {
        const ex = makeMoldExercise({ shape }, 2, owned, rng);
        assert.equal(new Set(ex.choices).size, 4);
        assert.ok(childReads(ex.clue, shape), `${shape}: ${clueWord(ex.clue)}`);
        for (const c of ex.choices) {
          if (c !== shape) assert.ok(!childReads(ex.clue, c), `${shape}: « ${clueWord(ex.clue)} » also fits ${c} (owned ${owned.join(',')})`);
        }
      }
    }
  }
});

test('N2: every clue has its own pictogram and word; no fun clue is drawn as a polygon or a point', () => {
  const geo = new Set(['pict-coin', 'pict-cote', 'pict-rond']);
  const funPicts = Object.values(FUN_PICT);
  assert.equal(new Set(funPicts).size, funPicts.length, 'one pictogram per fun clue');
  for (const shape of Object.keys(SHAPE_PROPS)) {
    for (const clue of cluesFor(shape)) {
      const pict = cluePict(clue);
      assert.ok(pict, `${shape} ${JSON.stringify(clue)} has a pictogram`);
      assert.ok(clueWord(clue), `${shape} ${JSON.stringify(clue)} has a word`);
      if (clue.kind === 'fun') {
        assert.ok(!geo.has(pict) && !/pointe|triangle/.test(pict), `${shape}: ${pict}`);
        assert.ok(!/pointe/.test(clueWord(clue)) || clue.n >= 5, `${shape}: « ${clueWord(clue)} »`);
      }
    }
  }
  assert.equal(clueWord(cluesFor('coeur')[0]), '2 bosses');
  assert.equal(cluePict(cluesFor('coeur')[0]), 'pict-bosses');
  assert.equal(cluePict(cluesFor('etoile')[0]), 'pict-branche');
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

test('cutSide puts every cell centre in its own piece', () => {
  const rng = makeRng(3);
  for (const [m, shape] of [[triangleMask, 'triangle'], [losangeMask, 'losange'], [rectMask, 'rectangle'], [hexMask, 'hexagone']]) {
    for (let i = 0; i < 40; i++) {
      const pieces = cutTangram(m, SIZE, shape, rng);
      const side = cutSide(pieces[0].cut);
      pieces.forEach((p, k) => {
        assert.equal(p.index, k);
        for (const c of p.cells) assert.equal(side((c % SIZE) + 0.5, Math.floor(c / SIZE) + 0.5), k);
      });
    }
  }
});

// A cut of a known kind: the first piece list cutTangram returns with that cut.
function cutOf(m, shape, kind, parts = 2) {
  const rng = makeRng(11);
  for (let i = 0; i < 400; i++) {
    const pieces = cutTangram(m, SIZE, shape, rng);
    if (pieces[0].cut.kind === kind && pieces.length === parts) return pieces;
  }
  throw new Error(`no ${kind} cut`);
}

// The pieces as the scene sees them: the shape sampled 4 times finer than the cut grid, each point
// given to its piece by cutSide (straight cut lines).
function fineMasks(pred, pieces, k = 4) {
  const n = SIZE * k;
  const side = cutSide(pieces[0].cut);
  const owner = new Int8Array(n * n).fill(-1);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / k, v = (y + 0.5) / k;
      const e = 0.25 / k; // a point right on a cut line belongs to neither piece (as in the scene)
      const sides = [side(u - e, v - e), side(u + e, v + e), side(u + e, v - e), side(u - e, v + e)];
      if (pred(u, v) && sides.every(q => q === sides[0])) owner[y * n + x] = sides[0];
    }
  }
  return pieceMasks(owner, n, pieces.length);
}
const fitsOf = (pred, m, shape, kind, parts) => pieceFits(fineMasks(pred, cutOf(m, shape, kind, parts)));

test('pieceFits: which turned piece fills which place', () => {
  // halves of a sharp rectangle: each half fits both places upright or upside down, never on its side
  const rect = fitsOf(rectP, rectMask, 'rectangle', 'v');
  assert.deepEqual(rect[0][0].sort(), [0, 1]);
  assert.deepEqual(rect[0][2].sort(), [0, 1]);
  assert.deepEqual(rect[0][1], []);
  assert.deepEqual(rect[1][3], []);
  // rounded corners: a half turned upside down is the other half only
  const round = fitsOf(roundRectP, roundRectMask, 'rectangle', 'h');
  assert.deepEqual(round[0][0], [0]);
  assert.deepEqual(round[0][2], [1]);
  assert.deepEqual(round[1][2], [0]);
  // rounded thirds: the middle one fits only its own place (upright or upside down), the outer
  // ones each other's upside down
  const thirds = fitsOf(roundRectP, roundRectMask, 'rectangle', 'v', 3);
  assert.deepEqual(thirds[1][0], [1]);
  assert.deepEqual(thirds[1][2], [1]);
  assert.deepEqual(thirds[0][2], [2]);
  // halves of a triangle (vertical cut) are mirror images: only their own place, upright
  const tri = fitsOf(triangleP, triangleMask, 'triangle', 'v');
  for (const i of [0, 1]) {
    assert.deepEqual(tri[i][0], [i]);
    for (const r of [1, 2, 3]) assert.deepEqual(tri[i][r], []);
  }
  // diagonal halves of a losange: the other place, upside down
  const los = fitsOf(losangeP, losangeMask, 'losange', 'd1');
  assert.deepEqual(los[0][2], [1]);
  assert.deepEqual(los[1][2], [0]);
  assert.deepEqual(los[0][1], []);
  // every piece of every cut fits its own place upright
  const rng = makeRng(8);
  for (let i = 0; i < 30; i++) {
    const p = cutTangram(hexMask, SIZE, 'hexagone', rng);
    pieceFits(fineMasks(hexP, p)).forEach((f, k) => assert.ok(f[0].includes(k)));
  }
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
