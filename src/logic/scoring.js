import { DESSERTS } from './catalog.js';
import { bakeState } from './bake.js';

const OK = { ok: true };
const fail = reason => ({ ok: false, reason });

export const COVERAGE_OK = 0.85;
export const STEPS = ['pate', 'moule', 'cuisson', 'couleur', 'toppings'];

export function judgeDough(added, stirProgress, dessert) {
  const recipe = DESSERTS[dessert].recipe;
  const entries = Object.entries(added).filter(([, n]) => n > 0);
  if (entries.some(([k]) => !(k in recipe))) return fail('intrus');
  if (Object.entries(recipe).some(([k, n]) => (added[k] ?? 0) < n)) return fail('manque');
  if (Object.entries(recipe).some(([k, n]) => (added[k] ?? 0) > n)) return fail('trop');
  if (stirProgress < 1) return fail('pas-melange');
  return OK;
}

export function judgeShape(shape, order) {
  return shape === order.shape ? OK : fail('mauvaise-forme');
}

export function judgeBake(gauge) {
  const state = bakeState(gauge);
  return state === 'dore' ? OK : fail(state);
}

export function judgeColor(coverage, order) {
  if ((coverage[order.color] ?? 0) >= COVERAGE_OK) return OK;
  const [top] = Object.entries(coverage).sort((a, b) => b[1] - a[1])[0] ?? [];
  return top && top !== order.color ? fail('mauvaise-couleur') : fail('pas-couvert');
}

export function judgeToppings(placed, order) {
  if (placed.some(k => k !== order.topping)) return fail('mauvais-topping');
  if (placed.length < order.toppingCount) return fail('pas-assez');
  if (placed.length > order.toppingCount) return fail('trop');
  return OK;
}

export function scoreRound(results) {
  const coins = STEPS.filter(s => results[s]?.ok).length;
  return { coins, mood: coins === 5 ? 'content' : coins >= 3 ? 'bof' : 'fache' };
}
