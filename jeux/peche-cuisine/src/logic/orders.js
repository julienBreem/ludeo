// Orders that are always exactly achievable from the cooler stock.
import { usable, ofColor } from './stock.js';

export const ORDER_RULES = {
  1: { max: 5, counts: [1, 2] },
  2: { max: 10, counts: [2] },
  3: { max: 12, counts: [2, 3] },
};
export const ORDERS_PER_ROUND = 2;

const MAX_SUGGEST_SIZE = 6;

function rules(level) {
  return ORDER_RULES[level] || ORDER_RULES[1];
}

/** Calls visit(subset) for every subset of exactly k items (items in order). */
function eachSubset(items, k, visit) {
  const pick = [];
  const rec = (start) => {
    if (pick.length === k) {
      visit(pick);
      return;
    }
    for (let i = start; i < items.length; i++) {
      pick.push(items[i]);
      rec(i + 1);
      pick.pop();
    }
  };
  rec(0);
}

const sum = (fish) => fish.reduce((t, x) => t + x.weight, 0);

/** Every distinct {color, plates}, 1 <= plates <= max, that k usable fish of the colour add up to, k in counts. */
export function feasibleOrders(stock, level, colors, counts) {
  const { max } = rules(level);
  const pool = usable(stock, level);
  const orders = [];
  for (const color of colors) {
    const fish = ofColor(pool, color);
    const plates = new Set();
    for (const k of counts) {
      eachSubset(fish, k, (subset) => {
        const total = sum(subset);
        if (total >= 1 && total <= max) plates.add(total);
      });
    }
    for (const p of [...plates].sort((a, b) => a - b)) orders.push({ color, plates: p });
  }
  return orders;
}

/** Draws uniformly among the orders the level prefers, else among single fish, else null. */
export function drawOrder(stock, level, colors, rng, previous) {
  let options = feasibleOrders(stock, level, colors, rules(level).counts);
  if (options.length === 0) options = feasibleOrders(stock, level, colors, [1]);
  if (options.length === 0) return null;
  if (previous && options.length > 1) {
    options = options.filter((o) => !(o.color === previous.color && o.plates === previous.plates));
  }
  return options[Math.floor(rng() * options.length)];
}

/** True when the fish are non-empty, all of the order's colour, and weigh exactly the plates. */
export function isExactCombination(fish, order) {
  return fish.length > 0
    && fish.every((x) => x.color === order.color)
    && sum(fish) === order.plates;
}

/** A right combination, preferring a size the level likes, else any size; [] if none. */
export function suggestCombination(stock, order, level) {
  const fish = ofColor(usable(stock, level), order.color);
  const preferred = rules(level).counts;
  const others = [];
  for (let k = 1; k <= Math.min(MAX_SUGGEST_SIZE, fish.length); k++) {
    if (!preferred.includes(k)) others.push(k);
  }
  for (const k of [...preferred, ...others]) {
    let found = null;
    eachSubset(fish, k, (subset) => {
      if (!found && sum(subset) === order.plates) found = [...subset];
    });
    if (found) return found;
  }
  return [];
}
