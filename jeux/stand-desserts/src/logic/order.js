import { DESSERTS, ITEMS, ownedKeys } from './catalog.js';

export const ZONE_WEIGHTS = [0.5, 0.35, 0.15];
export const KIND_WEIGHTS = [0.5, 0.35, 0.15];
export const MAX_TOPPINGS = 6;
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

/**
 * parseOrderParam(value) -> Order | null (debug: ?debug&order=<value>)
 * `<shape>/<colour>-<colour>/<topping>:<n>-<topping>:<n>[/<dessert>]`, e.g.
 * `licorne/rose-violet-jaune/fraise:2-bougie:1-chantilly:3`. Any catalog key is accepted, owned
 * or not; anything unknown or malformed gives null. The dessert defaults to gateau.
 */
export function parseOrderParam(value) {
  if (typeof value !== 'string') return null;
  const [shape, glazeStr, toppingStr, dessert = 'gateau', ...rest] = value.split('/');
  if (rest.length || !glazeStr || !toppingStr) return null;
  const known = (kind, key) => ITEMS.some(i => i.kind === kind && i.key === key);
  if (!known('shape', shape) || !(dessert in DESSERTS)) return null;
  const glaze = glazeStr.split('-');
  if (glaze.length > 3 || new Set(glaze).size !== glaze.length || !glaze.every(c => known('color', c))) return null;
  const toppings = [];
  for (const t of toppingStr.split('-')) {
    const m = /^([a-z]+):([1-6])$/.exec(t);
    if (!m || !known('topping', m[1]) || toppings.some(x => x.key === m[1])) return null;
    toppings.push({ key: m[1], count: Number(m[2]) });
  }
  if (toppings.length > 3) return null;
  return { dessert, shape, glaze, toppings };
}
