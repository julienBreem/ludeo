import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payment, changeFor, totalOf, choices, RESERVE, FLOAT, paidFor, MAX_TOTAL } from '../jeux/stand-desserts/src/logic/money.js';
import { makeRng } from '../jeux/stand-desserts/src/logic/rng.js';

const SCORES = [1, 2, 3, 4, 5];
const seeds = Array.from({ length: 200 }, (_, i) => i + 1);

test('N1: score coins of 1', () => {
  for (const s of SCORES) assert.deepEqual(payment(s, 1, makeRng(s)), { coins: Array(s).fill(1) });
});

test('N2: coins of 1 and 2 totalling the score, always an addition (at least two pieces)', () => {
  for (const s of SCORES) for (const seed of seeds) {
    const { coins, due, paid } = payment(s, 2, makeRng(seed));
    assert.equal(due, undefined);
    assert.equal(paid, undefined);
    assert.equal(totalOf(coins), s, `${s}/${seed}`);
    assert.ok(coins.every(c => c === 1 || c === 2), `${s}/${seed}: ${coins}`);
    if (s >= 2) assert.ok(coins.length >= 2, `${s}/${seed}: at least two pieces (${coins})`);
    if (s >= 3) assert.ok(coins.includes(2), `${s}/${seed}: at least one 2 (${coins})`);
  }
  assert.deepEqual(payment(2, 2, makeRng(1)).coins, [1, 1]);
});

test('N3: ticket due = score, the client always pays more (5 up to 4, 10 at 5)', () => {
  for (const s of SCORES) for (const seed of seeds.slice(0, 20)) {
    const p = payment(s, 3, makeRng(seed));
    assert.equal(p.due, s);
    assert.ok(p.paid > p.due, `${s}: paid ${p.paid} > due ${p.due}`);
    assert.equal(p.paid, s <= 4 ? 5 : 10);
    assert.equal(p.paid, paidFor(s));
    assert.deepEqual(p.coins, [p.paid]);
  }
});

test('N3: the change is never 0 and always makeable from the float alone (and from till + reserve)', () => {
  for (const s of SCORES) {
    const p = payment(s, 3, makeRng(s));
    assert.ok(p.paid - p.due >= 1);
    const fromFloat = changeFor(p.due, p.paid, FLOAT);
    assert.ok(fromFloat, `float makes ${p.paid - p.due}`);
    assert.equal(totalOf(fromFloat), p.paid - p.due);
    for (const till of [[], [1], [2, 2], [5], [1, 2, 5], [1, 1, 1, 1, 1]]) {
      const change = changeFor(p.due, p.paid, [...till, ...RESERVE]);
      assert.ok(change, `${s} ${till}`);
      assert.equal(totalOf(change), p.paid - p.due);
    }
  }
});

test('changeFor: exact, fewest coins, null when the till cannot', () => {
  assert.deepEqual(changeFor(2, 5, [1, 1, 1, 2]), [2, 1]);
  assert.deepEqual(changeFor(2, 5, [2, 2, 1]), [2, 1]);
  assert.deepEqual(changeFor(5, 5, []), []);
  assert.equal(changeFor(2, 5, [2, 2]), null);
  assert.equal(changeFor(1, 5, [1, 1]), null);
  assert.equal(changeFor(1, 5, []), null);
  assert.equal(changeFor(6, 5, [1]), null);
  const till = [1, 2, 1];
  changeFor(3, 5, till);
  assert.deepEqual(till, [1, 2, 1]);
});

test('totalOf', () => {
  assert.equal(totalOf([]), 0);
  assert.equal(totalOf([5, 2, 1]), 8);
});

test('choices: 3 distinct values in range with the answer, deterministic, shuffled', () => {
  const positions = new Set();
  for (const level of [1, 2, 3]) for (let total = 0; total <= MAX_TOTAL; total++) for (const seed of seeds) {
    const c = choices(total, level, makeRng(seed));
    assert.equal(c.length, 3);
    assert.equal(new Set(c).size, 3);
    assert.ok(c.includes(total));
    assert.ok(c.every(v => Number.isInteger(v) && v >= 0 && v <= MAX_TOTAL), `${total}: ${c}`);
    assert.deepEqual(c, choices(total, level, makeRng(seed)));
    positions.add(c.indexOf(total));
  }
  assert.equal(positions.size, 3, 'the answer is not always at the same place');
});
