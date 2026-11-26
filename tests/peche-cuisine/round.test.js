import test from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from '../../jeux/peche-cuisine/src/logic/round.js';
import { defaultState } from '../../jeux/peche-cuisine/src/logic/save.js';
import { makeRng } from '../../jeux/peche-cuisine/src/logic/rng.js';

test('createRound: 4-slot list, nothing filled, results all true, levels kept', () => {
  const levels = { peche: 1, pesee: 2, cuisine: 3, decoupe: 1, dressage: 2 };
  const r = createRound({ levels, state: defaultState(), rng: makeRng(1) });
  assert.deepEqual(r.levels, levels);
  assert.equal(r.list.length, 4);
  for (const c of r.list) assert.ok(['bleu', 'rouge'].includes(c.color));
  assert.deepEqual(r.filled, [false, false, false, false]);
  assert.deepEqual(r.caught, []);
  assert.deepEqual(r.results, { peche: true, pesee: true, orders: [] });
  assert.equal(r.orderIndex, 0);
  assert.equal(r.order, null);
  assert.deepEqual(r.chosen, []);
});
