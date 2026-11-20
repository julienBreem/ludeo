// Service cash step (theme `monnaie`): what the client pays, the change, the total to choose.
// Coins and notes are plain values (1, 2, 5, 10). `rng` is a () => [0,1) function.

export const MAX_TOTAL = 10;
export const FLOAT = [2, 2, 1, 1, 1]; // N3: what is in the till before the client pays (makes 1..7)
export const RESERVE = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]; // the scene adds it when changeFor is null (not earnings)

// N3: the client always pays MORE than the amount due (spec: « le client paie plus (5, puis 10) »):
// a 5 note up to 4, a 10 note at 5. The change (1..5) is always makeable from FLOAT alone.
export const paidFor = due => (due <= 4 ? 5 : 10);

const pick = (rng, list) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

export function totalOf(coins) {
  return coins.reduce((a, b) => a + b, 0);
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * payment(score, level, rng) -> {coins, due?, paid?}
 * N1: `score` coins of 1. N2: 1 and 2 coins totalling `score`, always at least two pieces from 2 on
 * (an addition), and at least one 2 from 3 on (otherwise N2 is N1). With scores up to 5 a 5 note
 * could only come alone (nothing to add), so N2 pays in coins; the notes are N3's.
 * N3: `due` = score, `paid` = paidFor(due) > due (coins = [paid]).
 */
export function payment(score, level = 1, rng = Math.random) {
  if (level >= 3) {
    const paid = paidFor(score);
    return { coins: [paid], due: score, paid };
  }
  if (level === 2) {
    if (score <= 2) return { coins: Array(score).fill(1) };
    const coins = [];
    let left = score;
    while (left > 0) {
      const c = left >= 2 && rng() < 0.5 ? 2 : 1;
      coins.push(c);
      left -= c;
    }
    // at least one 2 (otherwise N2 is N1); a lone 2 (score 2) is handled above
    if (!coins.includes(2)) coins.splice(0, 2, 2);
    return { coins: shuffle(coins, rng) };
  }
  return { coins: Array(score).fill(1) };
}

/**
 * changeFor(due, paid, till) -> coins | null
 * The coins (from `till`, an array of values) that make paid - due, or null when it can't be made
 * (the scene then adds a reserve). Fewest coins first.
 */
export function changeFor(due, paid, till = []) {
  const need = paid - due;
  if (need < 0) return null;
  const sorted = [...till].sort((a, b) => b - a);
  // fewest-coins search over the till's coins (tiny sets)
  let best = null;
  const go = (i, left, acc) => {
    if (left === 0) { if (!best || acc.length < best.length) best = acc; return; }
    if (i >= sorted.length || (best && acc.length + 1 >= best.length)) return;
    if (sorted[i] <= left) go(i + 1, left - sorted[i], [...acc, sorted[i]]);
    go(i + 1, left, acc);
  };
  go(0, need, []);
  return best;
}

/**
 * choices(total, level, rng) -> 3 distinct values in 0..MAX_TOTAL, `total` among them, shuffled.
 * Wrong options stay close to the answer (±1, ±2) so counting is needed.
 */
export function choices(total, level = 1, rng = Math.random) {
  const out = [total];
  const near = shuffle([-2, -1, 1, 2], rng).map(d => total + d).filter(v => v >= 0 && v <= MAX_TOTAL);
  for (const v of near) if (out.length < 3) out.push(v);
  for (let v = 0; out.length < 3; v++) if (!out.includes(v)) out.push(v);
  return shuffle(out, rng);
}
