import test from 'node:test';
import assert from 'node:assert/strict';
import { addCoins, canBuy, buy } from '../jeux/stand-desserts/src/logic/economy.js';
import { defaultState } from '../jeux/stand-desserts/src/logic/save.js';

test('buy deducts price and adds item', () => {
  const s = { ...defaultState(), coins: 10 };
  const r = buy(s, 'topping:etoile');
  assert.equal(r.coins, 2);
  assert.ok(r.owned.includes('topping:etoile'));
  assert.equal(s.coins, 10);
  assert.ok(!s.owned.includes('topping:etoile'));
});

test('cannot afford -> null, state untouched', () => {
  const s = { ...defaultState(), coins: 7 };
  assert.equal(buy(s, 'topping:etoile'), null);
  assert.equal(s.coins, 7);
});

test('already owned -> null', () => {
  assert.equal(buy({ ...defaultState(), coins: 99 }, 'shape:rond'), null);
});

test('unknown id -> null', () => {
  assert.equal(buy({ ...defaultState(), coins: 99 }, 'shape:dragon'), null);
});

test('canBuy exact price', () => {
  assert.equal(canBuy({ ...defaultState(), coins: 8 }, 'topping:etoile'), true);
  assert.equal(canBuy({ ...defaultState(), coins: 7 }, 'topping:etoile'), false);
});

test('addCoins is immutable', () => {
  const s = defaultState();
  assert.equal(addCoins(s, 3).coins, 3);
  assert.equal(s.coins, 0);
});
