import test from 'node:test';
import assert from 'node:assert/strict';
import { LIST_LENGTH, ON_LIST_RATE, drawFishingList, matchSlot, spawnCatch } from '../../jeux/peche-cuisine/src/logic/fishing.js';
import { makeRng } from '../../jeux/peche-cuisine/src/logic/rng.js';
import { maxWeight } from '../../jeux/peche-cuisine/src/logic/fish.js';

const f = (id, color, size, weight) => ({ id, color, size, weight });
const COLORS = ['bleu', 'rouge', 'vert'];
const STOCKS = [
  [],
  [f('a', 'bleu', 'petit', 1), f('b', 'bleu', 'moyen', 3), f('c', 'rouge', 'petit', 1), f('d', 'rouge', 'grand', 4)],
  [f('a', 'bleu', 'grand', 9), f('b', 'bleu', 'moyen', 5), f('c', 'vert', 'petit', 1)],
  [f('a', 'bleu', 'petit', 1), f('b', 'bleu', 'petit', 2), f('c', 'bleu', 'petit', 3)],
];

test('always 4 slots with a petit', () => {
  const rng = makeRng(1);
  for (const stock of STOCKS) for (let i = 0; i < 200; i++) {
    const list = drawFishingList(stock, 1, COLORS, rng);
    assert.equal(list.length, LIST_LENGTH);
    assert.ok(list.some((c) => c.size === 'petit'));
  }
});

test('only owned colours', () => {
  const rng = makeRng(2);
  for (const stock of STOCKS) for (let i = 0; i < 200; i++) {
    for (const c of drawFishingList(stock, 1, ['bleu', 'rouge'], rng)) assert.ok(['bleu', 'rouge'].includes(c.color));
  }
});

test('every listed colour reaches 2 with the stock', () => {
  const rng = makeRng(3);
  for (const level of [1, 2]) for (const stock of STOCKS) for (let i = 0; i < 300; i++) {
    const list = drawFishingList(stock, level, COLORS, rng);
    const usableStock = stock.filter((x) => x.weight <= maxWeight(level));
    for (const color of new Set(list.map((c) => c.color))) {
      const n = list.filter((c) => c.color === color).length + usableStock.filter((x) => x.color === color).length;
      assert.ok(n >= 2, `${color} has ${n}`);
    }
  }
});

test('a colour scarce in the stock is listed more often (count term only)', () => {
  const rng = makeRng(4);
  // Both colours have a usable petit; rouge has 1 fish, bleu has 4.
  const stock = [
    f('a', 'bleu', 'petit', 1), f('b', 'bleu', 'moyen', 3), f('c', 'bleu', 'petit', 1), f('d', 'bleu', 'moyen', 2),
    f('e', 'rouge', 'petit', 1),
  ];
  let withRouge = 0;
  let withBleu = 0;
  for (let i = 0; i < 1000; i++) {
    const list = drawFishingList(stock, 1, ['bleu', 'rouge'], rng);
    if (list.some((c) => c.color === 'rouge')) withRouge++;
    if (list.some((c) => c.color === 'bleu')) withBleu++;
  }
  assert.ok(withRouge > 970, `rouge in ${withRouge}/1000`);
  assert.ok(withRouge > withBleu, `rouge ${withRouge} vs bleu ${withBleu}`);
});

test('a colour with no petit gets a petit more often, per slot of that colour', () => {
  const rng = makeRng(5);
  // Equal usable counts (2 each); only rouge lacks a usable petit.
  const stock = [
    f('a', 'bleu', 'petit', 1), f('b', 'bleu', 'moyen', 3),
    f('c', 'rouge', 'moyen', 3), f('d', 'rouge', 'grand', 4),
  ];
  const slots = { bleu: 0, rouge: 0 };
  const petits = { bleu: 0, rouge: 0 };
  for (let i = 0; i < 2000; i++) {
    for (const c of drawFishingList(stock, 1, ['bleu', 'rouge'], rng)) {
      slots[c.color]++;
      if (c.size === 'petit') petits[c.color]++;
    }
  }
  const pBleu = petits.bleu / slots.bleu;
  const pRouge = petits.rouge / slots.rouge;
  assert.ok(pRouge > pBleu + 0.1, `P(petit|rouge) ${pRouge.toFixed(2)} vs bleu ${pBleu.toFixed(2)}`);
});

test('two different lists over 20 draws with the same stock', () => {
  const rng = makeRng(6);
  const seen = new Set();
  for (let i = 0; i < 20; i++) seen.add(JSON.stringify(drawFishingList(STOCKS[1], 1, COLORS, rng)));
  assert.ok(seen.size > 1);
});

test('matchSlot finds the first free slot of same colour and size, -1 otherwise', () => {
  const list = [
    { color: 'bleu', size: 'petit' }, { color: 'rouge', size: 'petit' },
    { color: 'bleu', size: 'petit' }, { color: 'vert', size: 'grand' },
  ];
  assert.equal(matchSlot(list, [false, false, false, false], { color: 'bleu', size: 'petit' }), 0);
  assert.equal(matchSlot(list, [true, false, false, false], { color: 'bleu', size: 'petit' }), 2);
  assert.equal(matchSlot(list, [true, false, true, false], { color: 'bleu', size: 'petit' }), -1);
  assert.equal(matchSlot(list, [false, false, false, false], { color: 'bleu', size: 'grand' }), -1);
});

test('spawnCatch: over 1000 draws at least 50 % fill a free slot; only owned colours', () => {
  const rng = makeRng(7);
  const colors = ['bleu', 'rouge', 'vert'];
  const list = drawFishingList(STOCKS[1], 1, colors, rng);
  const filled = [false, false, false, false];
  let hits = 0;
  for (let i = 0; i < 1000; i++) {
    const c = spawnCatch(list, filled, colors, rng);
    assert.ok(colors.includes(c.color));
    if (matchSlot(list, filled, c) >= 0) hits++;
  }
  assert.ok(hits >= 500, `hits ${hits}`);
  assert.equal(ON_LIST_RATE, 0.6);
});

test('spawnCatch with every slot filled still returns a catch', () => {
  const rng = makeRng(8);
  const list = drawFishingList(STOCKS[1], 1, COLORS, rng);
  for (let i = 0; i < 50; i++) {
    const c = spawnCatch(list, [true, true, true, true], COLORS, rng);
    assert.ok(COLORS.includes(c.color));
    assert.ok(['petit', 'moyen', 'grand'].includes(c.size));
  }
});
