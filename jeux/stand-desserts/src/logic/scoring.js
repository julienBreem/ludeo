import { DESSERTS } from './catalog.js';
import { bakeState } from './bake.js';

const OK = { ok: true };
const fail = reason => ({ ok: false, reason });

export const COVERAGE_OK = 0.85;
export const STEPS = ['pate', 'moule', 'cuisson', 'couleur', 'toppings'];

// target: what must end up in the bowl per kind (logic/recipe.js; the dessert's fixed recipe when
// left out); prefilled: what was already in it (N3 complement). Kinds outside target are intruders.
export function judgeDough(added, stirProgress, dessert, target = DESSERTS[dessert].recipe, prefilled = {}) {
  const entries = Object.entries(added).filter(([, n]) => n > 0);
  const have = k => (prefilled[k] ?? 0) + (added[k] ?? 0);
  if (entries.some(([k]) => !(k in target))) return fail('intrus');
  if (Object.entries(target).some(([k, n]) => have(k) < n)) return fail('manque');
  if (Object.entries(target).some(([k, n]) => have(k) > n)) return fail('trop');
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

export function judgeColor(cells, colorKeys, zones, glaze) {
  for (let z = 0; z < glaze.length; z++) {
    const counts = new Array(colorKeys.length + 1).fill(0);
    let total = 0;
    for (let i = 0; i < zones.length; i++) {
      if (zones[i] !== z) continue;
      total++;
      const v = cells[i];
      if (v > 0 && v <= colorKeys.length) counts[v]++;
    }
    if (!total) continue;
    const want = colorKeys.indexOf(glaze[z]) + 1;
    if (want > 0 && counts[want] / total >= COVERAGE_OK) continue;
    let top = 0;
    for (let k = 1; k < counts.length; k++) if (counts[k] > counts[top]) top = k;
    if (top && top !== want) return { ok: false, reason: 'mauvaise-couleur', zone: z, color: colorKeys[top - 1] };
    return { ok: false, reason: 'pas-couvert', zone: z };
  }
  return OK;
}

// Paint bar: the share of the least-covered zone painted in any colour (colour-blind, so it tells
// nothing about which colour goes where). Zones with no cells are ignored; 1 when none has any.
// The bar is full at COVERAGE_OK, i.e. only when every zone could pass.
export function minZoneCoverage(cells, zones, nZones) {
  const total = new Array(nZones).fill(0);
  const painted = new Array(nZones).fill(0);
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (z < 0 || z >= nZones) continue;
    total[z]++;
    if (cells[i] > 0) painted[z]++;
  }
  let min = 1;
  for (let z = 0; z < nZones; z++) if (total[z]) min = Math.min(min, painted[z] / total[z]);
  return min;
}

export function judgeToppings(placed, toppings) {
  const want = new Map(toppings.map(t => [t.key, t.count]));
  const have = new Map();
  for (const k of placed) have.set(k, (have.get(k) ?? 0) + 1);
  for (const k of have.keys()) if (!want.has(k)) return { ok: false, reason: 'mauvais-topping', key: k };
  for (const { key, count } of toppings) {
    if ((have.get(key) ?? 0) < count) return { ok: false, reason: 'pas-assez', key };
  }
  for (const { key, count } of toppings) {
    if ((have.get(key) ?? 0) > count) return { ok: false, reason: 'trop', key };
  }
  return OK;
}

// Level 2: `slots` is what the child put in each ring slot (a topping key or null), `sequence` what
// each slot should hold. Wrong slots hold another kind, empty ones nothing (prefilled slots are
// part of both lists and always match). -> { ok } or { ok: false, reason: 'emplacements', wrong, empty }
// with the slot indexes.
export function judgeMotif(slots, sequence) {
  const wrong = [];
  const empty = [];
  sequence.forEach((want, i) => {
    const have = slots[i] ?? null;
    if (have === null) empty.push(i);
    else if (have !== want) wrong.push(i);
  });
  return wrong.length || empty.length ? { ok: false, reason: 'emplacements', wrong, empty } : OK;
}

// Judges a round's toppings by the order's mode. `placed`: topping keys put on the cake (modes
// counts and hints, free placement; exact counts, as judgeToppings), or the per-slot list
// (mode motif, as judgeMotif).
export function judgeOrderToppings(placed, order) {
  if (order.toppingMode === 'motif' && order.motif) return judgeMotif(placed, order.motif.sequence);
  return judgeToppings(placed, order.toppings);
}

const BITES = [0, 1, 1, 2, 3, 4];
export function bitesFor(coins) {
  return BITES[coins] ?? (coins > 5 ? 4 : 0);
}

export function scoreRound(results) {
  const coins = STEPS.filter(s => results[s]?.ok).length;
  return { coins, mood: coins === 5 ? 'content' : coins >= 3 ? 'bof' : 'fache' };
}
