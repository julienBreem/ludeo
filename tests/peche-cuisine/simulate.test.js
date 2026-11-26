import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../jeux/peche-cuisine/src/logic/rng.js';
import { drawWeight } from '../../jeux/peche-cuisine/src/logic/fish.js';
import { addFish, removeFish, releaseFish, ofColor, usable } from '../../jeux/peche-cuisine/src/logic/stock.js';
import { ORDER_RULES, ORDERS_PER_ROUND, drawOrder, isExactCombination, suggestCombination } from '../../jeux/peche-cuisine/src/logic/orders.js';
import { drawFishingList } from '../../jeux/peche-cuisine/src/logic/fishing.js';
import { defaultState, newFish } from '../../jeux/peche-cuisine/src/logic/save.js';
import { gameSetup } from '../../jeux/peche-cuisine/src/logic/setup.js';

const SEEDS = [11, 222, 3333];
const RELEASE_RATE = 0.1;

// Plays one round on `run` (mutates run.state and the counters).
function playRound(run, level, rng, setup) {
  const { colors, capacity } = setup;
  const list = drawFishingList(run.state.stock, level, colors, rng);
  for (const caught of list) {
    const weights = ofColor(run.state.stock, caught.color).map((x) => x.weight);
    const weight = drawWeight(caught.size, level, weights, rng);
    const made = newFish(run.state, caught, weight);
    const added = addFish(made.state.stock, made.fish, capacity);
    run.state = { ...made.state, stock: added.stock };
  }
  const someUsable = usable(run.state.stock, level).length > 0;

  let previous = null;
  for (let i = 0; i < ORDERS_PER_ROUND; i++) {
    const order = drawOrder(run.state.stock, level, colors, rng, previous);
    run.draws++;
    if (!order) {
      run.nulls++;
      if (i === 0 && someUsable) run.firstNullWithUsable++;
      continue;
    }
    previous = order;
    const combo = suggestCombination(run.state.stock, order, level);
    assert.ok(isExactCombination(combo, order), `no exact combination for ${JSON.stringify(order)}`);
    assert.ok(order.plates >= 1 && order.plates <= ORDER_RULES[level].max);
    run.state = { ...run.state, stock: removeFish(run.state.stock, combo.map((x) => x.id)) };
  }

  if (rng() < RELEASE_RATE && run.state.stock.length > 0) {
    const victim = run.state.stock[Math.floor(rng() * run.state.stock.length)];
    run.state = { ...run.state, stock: releaseFish(run.state.stock, victim.id) };
  }
}

const newRun = () => ({ state: defaultState(), draws: 0, nulls: 0, firstNullWithUsable: 0 });

for (const level of [1, 2, 3]) {
  for (const seed of SEEDS) {
    test(`level ${level}, seed ${seed}: 300 rounds never run out of orders`, () => {
      const rng = makeRng(seed);
      const run = newRun();
      const setup = gameSetup(run.state);
      for (let round = 0; round < 300; round++) playRound(run, level, rng, setup);
      assert.equal(run.draws, 300 * ORDERS_PER_ROUND);
      assert.ok(run.nulls / run.draws < 0.01, `null rate ${run.nulls}/${run.draws}`);
      assert.equal(run.firstNullWithUsable, 0, 'first order null although a usable fish existed');
    });
  }
}

test('dropping from level 3 to level 1 keeps null orders under 5 %', () => {
  for (const seed of SEEDS) {
    const rng = makeRng(seed);
    const run = newRun();
    const setup = gameSetup(run.state);
    for (let round = 0; round < 50; round++) playRound(run, 3, rng, setup);
    run.draws = 0;
    run.nulls = 0;
    run.firstNullWithUsable = 0;
    for (let round = 0; round < 200; round++) playRound(run, 1, rng, setup);
    assert.ok(run.nulls / run.draws < 0.05, `seed ${seed}: null rate ${run.nulls}/${run.draws}`);
    assert.equal(run.firstNullWithUsable, 0, `seed ${seed}: first order null with usable fish`);
  }
});
