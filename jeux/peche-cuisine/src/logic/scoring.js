// Coins and client mood. Pure functions.
const count = (...flags) => flags.filter((f) => f === true).length;

/** Coins for the preparation: fishing and weighing, 0..2. */
export function prepCoins(results) {
  return count(results.peche, results.pesee);
}

/** Coins for one order: cooking, cutting and plating, 0..3. */
export function orderCoins(o) {
  return count(o.cuisine, o.decoupe, o.dressage);
}

export function mood(points) {
  if (points >= 3) return 'content';
  if (points >= 1) return 'bof';
  return 'fache';
}
