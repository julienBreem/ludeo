import { DESSERTS, ownedKeys } from './catalog.js';

export const ZONE_WEIGHTS = [0.5, 0.35, 0.15];
export const KIND_WEIGHTS = [0.5, 0.35, 0.15];
export const MAX_TOPPINGS = 8;
const MAX_COUNT = 4;

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

// Returns 1..weights.length, never more than `max`.
function pickSize(weights, max, rng) {
  const r = rng();
  let acc = 0;
  let n = weights.length;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r < acc) { n = i + 1; break; }
  }
  return Math.min(n, max);
}

function pickDistinct(list, n, rng) {
  const pool = [...list];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

export function generateOrder(owned, rng = Math.random) {
  const colors = ownedKeys(owned, 'color');
  const kinds = ownedKeys(owned, 'topping');
  const glaze = pickDistinct(colors, pickSize(ZONE_WEIGHTS, colors.length, rng), rng);
  const keys = pickDistinct(kinds, pickSize(KIND_WEIGHTS, kinds.length, rng), rng);
  let counts;
  do {
    counts = keys.map(() => 1 + Math.floor(rng() * MAX_COUNT));
  } while (counts.reduce((a, b) => a + b, 0) > MAX_TOPPINGS);
  return {
    dessert: pick(Object.keys(DESSERTS), rng),
    shape: pick(ownedKeys(owned, 'shape'), rng),
    glaze,
    toppings: keys.map((key, i) => ({ key, count: counts[i] })),
  };
}
