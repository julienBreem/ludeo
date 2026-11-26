// Fish categories and the weight range of each one, by level.
export const SIZES = ['petit', 'moyen', 'grand'];

const N1 = { petit: [1, 1], moyen: [2, 3], grand: [4, 5] };
const N2_N3 = { petit: [1, 3], moyen: [4, 6], grand: [7, 10] };

function table(level) {
  return level === 2 || level === 3 ? N2_N3 : N1; // unknown level: treated as 1
}

/** Inclusive [min, max] weight of a size at a level (a fresh array each call). */
export function weightRange(size, level) {
  return [...table(level)[size]];
}

/** Heaviest possible fish at a level. */
export function maxWeight(level) {
  return Math.max(...Object.values(table(level)).map(r => r[1]));
}

/**
 * Draw an integer weight for a size. Weights the colour does not have yet
 * count double, so the cooler tends to fill with different weights.
 */
export function drawWeight(size, level, colorWeights, rng) {
  const [min, max] = weightRange(size, level);
  const values = [];
  const weights = [];
  let total = 0;
  for (let w = min; w <= max; w++) {
    const p = colorWeights.includes(w) ? 1 : 2;
    values.push(w);
    weights.push(p);
    total += p;
  }
  let r = rng() * total;
  for (let i = 0; i < values.length; i++) {
    r -= weights[i];
    if (r < 0) return values[i];
  }
  return values[values.length - 1];
}
