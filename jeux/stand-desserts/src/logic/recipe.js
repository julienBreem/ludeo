// Pâte (theme `nombres`): the round's recipe, generated from the dessert's ingredient kinds and the
// phase level. The kinds are the dessert's (DESSERTS[d].recipe); only the quantities are generated,
// so the intruders are unchanged.
//
// makeRecipe(dessert, level, rng) -> { target, display, prefilled, double }
// - target[k]: how many of k must end up in the bowl (prefilled included).
// - display[k]: how the recipe card shows k:
//   dice {n}            N1, a die face, n 1..5
//   digit {n}           N2–N3; {n, times: 2} at N3 is a doubled column (the card shows n and « ×2 »
//                       under it, target = 2 n)
//   sum {a, b, n}       a + b = n, a, b >= 1 (exactly one at N2; sometimes one at N3), never doubled
//   complement {n}      N3, exactly one: « n are needed » (n is the final total, never doubled),
//                       prefilled[k] are already in the bowl
// - prefilled[k]: already in the bowl (N3, the complement kind only, 1..5: the tray holds 5).
// - double: some column is doubled (N3, sometimes; exactly one digit column then).
//
// Workload (Ruling 6): at N2–N3 only one or two kinds carry the exercise (the sum, the complement,
// a doubled or a big number); the other kinds are 1..3. What she pours in all is at most 15 at N2
// and 20 at N3 (the 5-egg carton helps with eggs).
//
// Board capacity (art-geometry.md): a lane holds 10 empties, the two egg boxes 20 shells, the tray
// 5 items. What she must pour of a kind stays one below that (9, 19 eggs), so the board never fills
// up exactly at the answer (a full lane refuses the next item: that would tell her « enough ») and
// « trop » can always be made. Every target is at most 20, and at N3 the complement always leaves at
// least one to pour (target > prefilled).
import { DESSERTS } from './catalog.js';

export const MAX_TARGET = 20;
export const PREFILL_MAX = 5;
export const N1_MAX = 5;
export const N2_MAX = 10;
export const SMALL_MAX = 3; // the kinds that carry no exercise
export const MAX_POUR_TOTAL = { 2: 15, 3: 20 };
const BIG_MIN = 4;
const DOUBLE_P = 0.35;
const N3_SUM_P = 0.4; // after the double: sum, else a big number
const N2_SECOND_P = 0.5; // N2: a big number besides the sum

// What fits on the board of one kind (board lane, or two egg boxes).
export function pourCap(kind) {
  return kind === 'oeuf' ? 20 : 10;
}

// The most a recipe asks her to pour of one kind: one below the board's capacity.
export function pourMax(kind) {
  return pourCap(kind) - 1;
}

const int = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1));

function sum(n, rng) {
  const a = int(1, n - 1, rng);
  return { kind: 'sum', a, b: n - a, n };
}

// A number in lo..hi, or the largest possible below lo when the budget is short.
const upTo = (lo, hi, rng) => (hi >= lo ? int(lo, hi, rng) : Math.max(1, hi));

export function makeRecipe(dessert, level, rng = Math.random) {
  const kinds = Object.keys(DESSERTS[dessert]?.recipe ?? DESSERTS.gateau.recipe);
  const target = {};
  const display = {};
  const prefilled = {};
  let double = false;

  if (level <= 1) {
    for (const k of kinds) {
      const n = int(1, N1_MAX, rng);
      display[k] = { kind: 'dice', n };
      target[k] = n;
    }
    return { target, display, prefilled, double };
  }

  // the exercise kinds and their roles, then the small kinds, then the exercises within the budget
  const shuffled = [...kinds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const roles = [];
  if (level === 2) {
    roles.push('sum');
    if (rng() < N2_SECOND_P) roles.push('big');
  } else {
    roles.push('complement');
    const r = rng();
    roles.push(r < DOUBLE_P ? 'double' : r < DOUBLE_P + (1 - DOUBLE_P) * N3_SUM_P ? 'sum' : 'big');
  }
  const exercise = roles.map((role, i) => ({ role, k: shuffled[i] }));
  let budget = MAX_POUR_TOTAL[level];
  for (const k of shuffled.slice(roles.length)) {
    const n = int(1, SMALL_MAX, rng);
    display[k] = { kind: 'digit', n };
    target[k] = n;
    budget -= n;
  }
  // the least each exercise needs to pour, kept for the ones drawn after it
  const least = { sum: 2, big: BIG_MIN, double: 4, complement: 1 };
  exercise.forEach(({ role, k }, i) => {
    const reserve = exercise.slice(i + 1).reduce((a, e) => a + least[e.role], 0);
    const room = Math.min(pourMax(k), budget - reserve);
    let pour;
    if (role === 'sum') {
      display[k] = sum(upTo(2, Math.min(room, level === 2 ? N2_MAX : MAX_TARGET), rng), rng);
      pour = display[k].n;
    } else if (role === 'big') {
      const n = upTo(BIG_MIN, Math.min(room, level === 2 ? N2_MAX : MAX_TARGET), rng);
      display[k] = { kind: 'digit', n };
      pour = n;
    } else if (role === 'double') {
      const n = upTo(2, Math.floor(room / 2), rng);
      display[k] = { kind: 'digit', n, times: 2 };
      pour = 2 * n;
      double = true;
    } else {
      const p = int(1, PREFILL_MAX, rng);
      pour = upTo(1, Math.min(room, MAX_TARGET - p), rng);
      prefilled[k] = p;
      display[k] = { kind: 'complement', n: p + pour };
    }
    target[k] = (prefilled[k] ?? 0) + pour;
    budget -= pour;
  });
  return { target, display, prefilled, double };
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
