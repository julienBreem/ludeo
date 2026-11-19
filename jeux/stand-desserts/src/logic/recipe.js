// Pâte (theme `nombres`): the round's recipe, generated from the dessert's ingredient kinds and the
// phase level. The kinds are the dessert's (DESSERTS[d].recipe); only the quantities are generated,
// so the intruders are unchanged.
//
// makeRecipe(dessert, level, rng) -> { target, display, prefilled, double }
// - target[k]: how many of k must end up in the bowl (prefilled included).
// - display[k]: how the recipe card shows k:
//   dice {n}            N1, a die face, n 1..4
//   digit {n}           N2–N3, 1..3; {n, times: 2} at N3 is a doubled column (the card shows n and
//                       « ×2 » under it, n 2..4, target = 2 n)
//   sum {a, b, n}       a + b = n, a, b >= 1, n <= 6 (exactly one at N2; sometimes one at N3), never
//                       doubled
//   complement {n}      N3, exactly one: « n are needed » (n <= 10 is the final total, never doubled,
//                       Ruling 5), prefilled[k] are already in the bowl
// - prefilled[k]: already in the bowl (N3, the complement kind only, 1..5: the tray holds 5).
// - double: some column is doubled (N3, sometimes; exactly one digit column then).
//
// Numbers (spec 2 bis, after the parent's first look): N1 1..4 per kind, at most 8 to pour in all;
// N2 one sum of at most 6, the other kinds 1..3, at most 10 in all; N3 one complement of total at
// most 10, sometimes a ×2 on a number <= 4 or a sum, the other kinds 1..3, at most 12 in all.
// Only one or two kinds carry the exercise (Ruling 6).
//
// Board capacity (art-geometry.md): a lane holds 10 empties, the two egg boxes 20 shells, the tray
// 5 items. What she must pour of a kind is at most 9 (the complement of 10 with one already in the
// bowl), so the board never fills up exactly at the answer (a full lane refuses the next item: that
// would tell her « enough ») and « trop » can always be made. At N3 the complement always leaves at
// least one to pour (target > prefilled).
import { DESSERTS } from './catalog.js';

export const N1_MAX = 4;
export const SMALL_MAX = 3; // the kinds that carry no exercise (N2–N3)
export const SUM_MAX = 6;
export const DOUBLE_MAX = 4; // the doubled number (before ×2)
export const COMPLEMENT_MAX = 10; // the complement's total (prefilled included)
export const PREFILL_MAX = 5;
export const MAX_TARGET = COMPLEMENT_MAX;
export const MAX_POUR_TOTAL = { 1: 8, 2: 10, 3: 12 };
const DOUBLE_P = 0.35;
const N3_SUM_P = 0.4; // after the double: a sum, else only small kinds besides the complement

// What fits on the board of one kind (board lane, or two egg boxes).
export function pourCap(kind) {
  return kind === 'oeuf' ? 20 : 10;
}

// The most a recipe may ask her to pour of one kind: one below the board's capacity.
export function pourMax(kind) {
  return pourCap(kind) - 1;
}

// Multi-grab: how many of kind her hand may hold, i.e. what the board can still take of it.
export function grabLimit(kind, added = {}) {
  return Math.max(0, pourCap(kind) - (added[kind] ?? 0));
}

const int = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1));

// One quantity per kind, drawn in the given order within a total budget: role -> the range of its
// number n (what she pours is step x n), the least of the kinds drawn later kept in reserve.
const RANGE = {
  dice: { lo: 1, hi: N1_MAX, step: 1 },
  small: { lo: 1, hi: SMALL_MAX, step: 1 },
  sum: { lo: 2, hi: SUM_MAX, step: 1 },
  double: { lo: 2, hi: DOUBLE_MAX, step: 2 },
  complement: { lo: 1, hi: COMPLEMENT_MAX - 1, step: 1 }, // what is left to pour
};

export function makeRecipe(dessert, level, rng = Math.random) {
  const kinds = Object.keys(DESSERTS[dessert]?.recipe ?? DESSERTS.gateau.recipe);
  const target = {};
  const display = {};
  const prefilled = {};
  let double = false;

  // the kinds in a random order; the first ones carry the exercise
  const shuffled = [...kinds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const roles = [];
  if (level <= 1) {
    // nothing: every kind is a die
  } else if (level === 2) {
    roles.push('sum');
  } else {
    roles.push('complement');
    const r = rng();
    if (r < DOUBLE_P) roles.push('double');
    else if (r < DOUBLE_P + (1 - DOUBLE_P) * N3_SUM_P) roles.push('sum');
  }
  const plain = level <= 1 ? 'dice' : 'small';
  const plan = shuffled.map((k, i) => ({ k, role: roles[i] ?? plain }));
  let budget = MAX_POUR_TOTAL[Math.min(3, Math.max(1, level))];
  plan.forEach(({ k, role }, i) => {
    const reserve = plan.slice(i + 1).reduce((a, e) => a + RANGE[e.role].lo * RANGE[e.role].step, 0);
    const { lo, hi, step } = RANGE[role];
    const room = Math.min(pourMax(k), budget - reserve);
    const n = int(lo, Math.max(lo, Math.min(hi, Math.floor(room / step))), rng);
    const pour = n * step;
    if (role === 'dice') display[k] = { kind: 'dice', n };
    else if (role === 'small') display[k] = { kind: 'digit', n };
    else if (role === 'sum') {
      const a = int(1, n - 1, rng);
      display[k] = { kind: 'sum', a, b: n - a, n };
    } else if (role === 'double') {
      display[k] = { kind: 'digit', n, times: 2 };
      double = true;
    } else {
      const p = int(1, Math.min(PREFILL_MAX, COMPLEMENT_MAX - pour), rng);
      prefilled[k] = p;
      display[k] = { kind: 'complement', n: p + pour };
    }
    target[k] = (prefilled[k] ?? 0) + pour;
    budget -= pour;
  });
  // the card lists the kinds in the dessert's order
  const ordered = o => Object.fromEntries(kinds.map(k => [k, o[k]]));
  return { target: ordered(target), display: ordered(display), prefilled, double };
}

// What she has to pour of k: the target minus what is already in the bowl.
export function toPour(recipe, k) {
  return (recipe.target[k] ?? 0) - (recipe.prefilled[k] ?? 0);
}

// The recipe of a round that has none (debug entries, a round from before levels): the dessert's
// fixed quantities, shown as dice.
export function fixedRecipe(dessert) {
  const r = DESSERTS[dessert]?.recipe ?? DESSERTS.gateau.recipe;
  return {
    target: { ...r },
    display: Object.fromEntries(Object.entries(r).map(([k, n]) => [k, { kind: 'dice', n }])),
    prefilled: {},
    double: false,
  };
}
