import { DESSERTS, ownedKeys } from './catalog.js';

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

export function generateOrder(owned, rng = Math.random) {
  return {
    dessert: pick(Object.keys(DESSERTS), rng),
    shape: pick(ownedKeys(owned, 'shape'), rng),
    color: pick(ownedKeys(owned, 'color'), rng),
    topping: pick(ownedKeys(owned, 'topping'), rng),
    toppingCount: 1 + Math.floor(rng() * 5),
  };
}
