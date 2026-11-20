import { DESSERTS, ITEMS, ownedKeys } from './catalog.js';
import { basesOf, obtainable, mixedColors, BASES, EXTRA_BASES, RECIPES } from './colors.js';

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

const MAX_HINT_TOTAL = 8;
export const MAX_RING_SLOTS = 8;

// Equal-band patterns of level 3: letters are colours, each letter one run of adjacent bands, so
// every colour covers a plain fraction (1/3, 2/3, 1/4, 1/2, 3/4) and at least one is repeated.
export const BAND_PATTERNS = [
  [0, 0, 1], [0, 1, 1],
  [0, 0, 0, 1], [0, 1, 1, 1], [0, 0, 1, 1], [0, 0, 1, 2], [0, 1, 1, 2], [0, 1, 2, 2],
];

// Motifs of level 2, one period (letters are topping kinds): AB, then AAB, then ABC.
export const MOTIFS = [[0, 1], [0, 0, 1], [0, 1, 2]];

export const N1_MAX_BANDS = 2;

// The letters of a band list (first colour 0, next new one 1, ...): [rose, rose, vert] -> [0, 0, 1].
function lettersOf(bands) {
  const seen = [];
  return bands.map((c) => {
    if (!seen.includes(c)) seen.push(c);
    return seen.indexOf(c);
  });
}

const levelOf = (levels, phase) => ([1, 2, 3].includes(levels?.[phase]) ? levels[phase] : 1);

function countsOf(keys) {
  const m = new Map();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].map(([key, count]) => ({ key, count }));
}

// Swaps one colour of the list for a mixed one (a random one not already there) when none is.
function ensureMixed(colors, mixed, rng) {
  if (colors.some(c => mixed.includes(c))) return colors;
  const free = mixed.filter(c => !colors.includes(c));
  if (!free.length) return colors;
  const out = [...colors];
  out[Math.floor(rng() * out.length)] = pick(free, rng);
  return out;
}

function glazeBandsFor(level, owned, rng) {
  if (level === 1) {
    // N1: halves at most (1 or 2 bands)
    const colors = ownedKeys(owned, 'color');
    return pickDistinct(colors, pickSize(ZONE_WEIGHTS, Math.min(N1_MAX_BANDS, colors.length), rng), rng);
  }
  const bases = basesOf(owned);
  const all = obtainable(bases);
  const mixed = mixedColors(bases);
  if (level === 2) {
    return ensureMixed(pickDistinct(all, pickSize(ZONE_WEIGHTS, 3, rng), rng), mixed, rng);
  }
  const pattern = pick(BAND_PATTERNS, rng);
  const letters = Math.max(...pattern) + 1;
  const colors = ensureMixed(pickDistinct(all, letters, rng), mixed, rng);
  return pattern.map(i => colors[i]);
}

// Level 2: a ring of 6 or 8 slots, the start of the motif already placed (at least two periods,
// at least two slots left to fill). AB may use 6 slots; AAB and ABC need 8.
function motifFor(kinds, rng) {
  const usable = MOTIFS.filter(m => Math.max(...m) + 1 <= kinds.length);
  if (!usable.length) return null;
  const letters = pick(usable, rng);
  const used = pickDistinct(kinds, Math.max(...letters) + 1, rng);
  const pattern = letters.map(i => used[i]);
  const slots = letters.length === 2 && rng() < 0.5 ? 6 : MAX_RING_SLOTS;
  const maxPrefill = slots - 2;
  const minPrefill = 2 * pattern.length;
  const prefill = minPrefill + Math.floor(rng() * (Math.min(maxPrefill, 6) - minPrefill + 1));
  const sequence = Array.from({ length: slots }, (_, i) => pattern[i % pattern.length]);
  return { slots, pattern, sequence, prefill };
}

// solveHints(hints) -> [{key, count}] or null. A hint is {key, rel: 'count', count} (the card
// shows `count` of the picture), or {key, rel: 'same'|'plus'|'minus', of, n} (the key equals the
// count of `of`, plus or minus n). Null unless every kind is fixed exactly once by an earlier
// kind and every count is >= 1.
export function solveHints(hints) {
  const counts = new Map();
  for (const h of hints) {
    if (counts.has(h.key)) return null;
    let n;
    if (h.rel === 'count') n = h.count;
    else if (counts.has(h.of)) n = counts.get(h.of) + (h.rel === 'plus' ? h.n : h.rel === 'minus' ? -h.n : 0);
    else return null;
    if (!Number.isInteger(n) || n < 1) return null;
    counts.set(h.key, n);
  }
  return [...counts].map(([key, count]) => ({ key, count }));
}

// Level 3: the card gives one kind by pictures, the others by « = », « + 1 » or (with 2 or more
// to take from) « − 1 » on an earlier kind. Total <= 8, every count >= 1.
function hintCardFor(kinds, rng) {
  if (kinds.length < 2) return null;
  for (let attempt = 0; attempt < 50; attempt++) {
    const nKinds = Math.min(kinds.length, 2 + Math.floor(rng() * 2));
    const keys = pickDistinct(kinds, nKinds, rng);
    const hints = [{ key: keys[0], rel: 'count', count: 2 + Math.floor(rng() * 3) }];
    for (let i = 1; i < keys.length; i++) {
      const rel = pick(['same', 'plus', 'minus'], rng);
      hints.push({ key: keys[i], rel, of: keys[Math.floor(rng() * i)], n: rel === 'same' ? 0 : 1 });
    }
    const solution = solveHints(hints);
    if (solution && solution.reduce((a, t) => a + t.count, 0) <= MAX_HINT_TOTAL) return { hints, solution };
  }
  const [a, b] = kinds;
  const hints = [{ key: a, rel: 'count', count: 3 }, { key: b, rel: 'same', of: a, n: 0 }];
  return { hints, solution: solveHints(hints) };
}

function countsToppings(kinds, rng) {
  const keys = pickDistinct(kinds, pickSize(KIND_WEIGHTS, kinds.length, rng), rng);
  let counts;
  do {
    counts = keys.map(() => 1 + Math.floor(rng() * MAX_COUNT));
  } while (counts.reduce((a, b) => a + b, 0) > MAX_TOPPINGS);
  return keys.map((key, i) => ({ key, count: counts[i] }));
}

/**
 * generateOrder(owned, rng, levels) -> Order
 * `levels` is the round's phase levels ({couleur, toppings, ...}); a missing or unknown level is 1.
 * Always: dessert, shape, `glaze` (the colour of each equal band, left to right: same list as
 * glazeBands) and `toppings` ([{key, count}], the total the cake needs, whatever the mode).
 * Added by level:
 *  - glazeBands: colour per band; level 1 as before (<= 3 distinct); level 2 up to 3 distinct,
 *    all obtainable with the owned bases, at least one needing a mix; level 3 has 3 or 4 bands
 *    with adjacent bands sharing a colour (BAND_PATTERNS), same colour rules.
 *  - toppingMode 'counts' (level 1, as before), 'motif' (level 2: `motif` = {slots, pattern,
 *    sequence, prefill}) or 'hints' (level 3: `hintCard` = {hints, solution}).
 */
export function generateOrder(owned, rng = Math.random, levels = {}) {
  const lc = levelOf(levels, 'couleur');
  const lt = levelOf(levels, 'toppings');
  const glazeBands = glazeBandsFor(lc, owned, rng);
  const tops = toppingsFor(ownedKeys(owned, 'topping'), lt, rng);
  const order = {
    dessert: pick(Object.keys(DESSERTS), rng),
    shape: pick(ownedKeys(owned, 'shape'), rng),
    glaze: [...glazeBands],
    glazeBands,
    toppings: tops.toppings,
    toppingMode: tops.toppingMode,
  };
  if (tops.motif) order.motif = tops.motif;
  if (tops.hintCard) order.hintCard = tops.hintCard;
  return order;
}

/**
 * toppingsFor(kinds, level, rng) -> {toppingMode, toppings, motif?, hintCard?}
 * The toppings part of an order for a Toppings level, from the kinds that can be used: level 1
 * counts; level 2 a motif (falls back to counts with fewer than 2 kinds); level 3 a hint card
 * (same fallback).
 */
export function toppingsFor(kinds, level, rng = Math.random) {
  const motif = level === 2 ? motifFor(kinds, rng) : null;
  const hintCard = level === 3 ? hintCardFor(kinds, rng) : null;
  if (motif) return { toppingMode: 'motif', toppings: countsOf(motif.sequence), motif };
  if (hintCard) return { toppingMode: 'hints', toppings: hintCard.solution.map(t => ({ ...t })), hintCard };
  return { toppingMode: 'counts', toppings: countsToppings(kinds, rng) };
}

/**
 * withToppingLevel(order, level, rng) -> Order (debug: ?debug&order= at Toppings N2 / N3)
 * An order given as plain counts (parseOrderParam) gets the motif or the hint card of that level,
 * made with its own topping kinds. An order that already has a mode is returned as it is.
 */
export function withToppingLevel(order, level, rng = Math.random) {
  if (!order || order.toppingMode || ![2, 3].includes(level)) return order;
  const tops = toppingsFor(order.toppings.map(t => t.key), level, rng);
  if (tops.toppingMode === 'counts') return { ...order, toppingMode: 'counts' };
  return { ...order, ...tops };
}

/**
 * ringPositions(n) -> [{x, y}] n slots on the cake's top face, centre-relative, in 400-frame
 * units (top-down, before the 3/4 squash, as toppingSpots). On a circle, the first slot just
 * right of the top going clockwise; the set is mirror-symmetric left/right (and top/bottom).
 */
export function ringPositions(n, radius = 115) {
  return Array.from({ length: n }, (_, k) => {
    const a = ((-90 + (360 * (k + 0.5)) / n) * Math.PI) / 180;
    return { x: Math.round(radius * Math.cos(a) * 1000) / 1000, y: Math.round(radius * Math.sin(a) * 1000) / 1000 };
  });
}

/**
 * parseOrderParam(value) -> Order | null (debug: ?debug&order=<value>)
 * `<shape>/<colour>-<colour>/<topping>:<n>-<topping>:<n>[/<dessert>]`, e.g.
 * `licorne/rose-violet-jaune/fraise:2-bougie:1-chantilly:3`. Any catalog key is accepted, owned
 * or not (colours: also the mixing bases and mixes, e.g. rouge, orange); anything unknown or
 * malformed gives null. The dessert defaults to gateau. The glaze is 1 to 3 distinct colours, or
 * a level-3 fraction pattern (BAND_PATTERNS, e.g. rose-rose-violet, jaune-vert-vert-vert).
 */
export function parseOrderParam(value) {
  if (typeof value !== 'string') return null;
  const [shape, glazeStr, toppingStr, dessert = 'gateau', ...rest] = value.split('/');
  if (rest.length || !glazeStr || !toppingStr) return null;
  const known = (kind, key) => ITEMS.some(i => i.kind === kind && i.key === key);
  if (!known('shape', shape) || !(dessert in DESSERTS)) return null;
  const glaze = glazeStr.split('-');
  const colour = c => known('color', c) || BASES.includes(c) || EXTRA_BASES.includes(c) || c in RECIPES;
  const distinct = glaze.length <= 3 && new Set(glaze).size === glaze.length;
  const pattern = BAND_PATTERNS.some(p => p.join() === lettersOf(glaze).join());
  if (!(distinct || pattern) || !glaze.every(colour)) return null;
  const toppings = [];
  for (const t of toppingStr.split('-')) {
    const m = /^([a-z]+):([1-6])$/.exec(t);
    if (!m || !known('topping', m[1]) || toppings.some(x => x.key === m[1])) return null;
    toppings.push({ key: m[1], count: Number(m[2]) });
  }
  if (toppings.length > 3) return null;
  return { dessert, shape, glaze, toppings };
}
