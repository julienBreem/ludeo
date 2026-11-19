// Pâte (theme `nombres`): the round's recipe, generated from the dessert's ingredient kinds and the
// phase level. The kinds are the dessert's (DESSERTS[d].recipe); only the quantities are generated,
// so the intruders are unchanged.
//
// makeRecipe(dessert, level, rng) -> { target, display, prefilled, double }
// - target[k]: how many of k must end up in the bowl (prefilled included).
// - display[k]: how the recipe card shows k. `n` is the shown number (before ×2):
//   dice {n}           N1, a die face, n 1..5
//   digit {n}          N2–N3
//   sum {a, b, n}      a + b = n, a, b >= 1 (exactly one at N2; sometimes one at N3)
//   complement {n}     N3, exactly one: "n are needed", prefilled[k] are already in the bowl
// - prefilled[k]: already in the bowl (N3, the complement kind only, 1..5: the tray holds 5).
// - double (N3, sometimes): every shown number is doubled, target[k] = 2 n.
//
// Board capacity (art-geometry.md): a lane holds 10 empties, the two egg boxes 20 shells, the tray
// 5 items. So what she must pour is at most 10 of a non-egg kind and 20 eggs, every target is at
// most 20, and at N3 the complement always leaves at least one to pour (target > prefilled).
import { DESSERTS } from './catalog.js';

export const MAX_TARGET = 20;
export const PREFILL_MAX = 5;
export const N1_MAX = 5;
export const N2_MAX = 10;
const DOUBLE_P = 0.35;
const N3_SUM_P = 0.5;

// What she may pour of one kind at most (board lane, or two egg boxes).
export function pourCap(kind) {
  return kind === 'oeuf' ? 20 : 10;
}

const int = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = (list, rng) => list[Math.floor(rng() * list.length)];

function sum(n, rng) {
  const a = int(1, n - 1, rng);
  return { kind: 'sum', a, b: n - a, n };
}

export function makeRecipe(dessert, level, rng = Math.random) {
  const kinds = Object.keys(DESSERTS[dessert]?.recipe ?? DESSERTS.gateau.recipe);
  const target = {};
  const display = {};
  const prefilled = {};
  let double = false;

  if (level >= 3) {
    double = rng() < DOUBLE_P;
    const mult = double ? 2 : 1;
    const comp = pick(kinds, rng);
    const others = kinds.filter(k => k !== comp);
    const sumKind = rng() < N3_SUM_P ? pick(others, rng) : null;
    for (const k of kinds) {
      const cap = Math.min(MAX_TARGET, pourCap(k));
      if (k === comp) {
        const p = int(1, PREFILL_MAX, rng);
        // n * mult > p, n * mult - p <= pourCap, n * mult <= MAX_TARGET
        const lo = Math.floor(p / mult) + 1;
        const hi = Math.floor(Math.min(MAX_TARGET, p + pourCap(k)) / mult);
        const n = int(lo, hi, rng);
        prefilled[k] = p;
        display[k] = { kind: 'complement', n };
        target[k] = n * mult;
      } else {
        const hi = Math.floor(cap / mult);
        display[k] = k === sumKind ? sum(int(2, hi, rng), rng) : { kind: 'digit', n: int(1, hi, rng) };
        target[k] = display[k].n * mult;
      }
    }
  } else if (level === 2) {
    const sumKind = pick(kinds, rng);
    for (const k of kinds) {
      display[k] = k === sumKind ? sum(int(2, N2_MAX, rng), rng) : { kind: 'digit', n: int(1, N2_MAX, rng) };
      target[k] = display[k].n;
    }
  } else {
    for (const k of kinds) {
      const n = int(1, N1_MAX, rng);
      display[k] = { kind: 'dice', n };
      target[k] = n;
    }
  }
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
