// Colour mixing for the glaze (levels 2-3): base pots, the mixing table, what can be obtained.
// Pure data and functions.

// Always on the shelf at levels 2-3; the shop adds more bases (EXTRA_BASES) later.
export const BASES = ['rouge', 'bleu', 'jaune', 'blanc'];
export const EXTRA_BASES = ['marron', 'noir'];
// What a mix of two pots that have no recipe gives: a muddy, unwanted colour.
export const MELANGE = 'melange';

// Recipes, each pair in the order shown to the child.
export const RECIPES = {
  rose: ['rouge', 'blanc'],
  violet: ['rouge', 'bleu'],
  vert: ['bleu', 'jaune'],
  orange: ['rouge', 'jaune'],
  bleuclair: ['bleu', 'blanc'],
  beige: ['marron', 'blanc'],
  gris: ['noir', 'blanc'],
};

const pairKey = (a, b) => [a, b].sort().join('+');
export const MIX = Object.fromEntries(Object.entries(RECIPES).map(([result, [a, b]]) => [pairKey(a, b), result]));

// mix(a, b) -> colour key. Symmetric; the same colour twice stays itself; any pair without a
// recipe (including a pot that is already a mix) gives MELANGE. Never throws.
export function mix(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return MELANGE;
  if (a === MELANGE || b === MELANGE) return MELANGE;
  if (a === b) return a;
  return MIX[pairKey(a, b)] ?? MELANGE;
}

// The base pots on the shelf for an owned list of catalog ids: the four fixed bases plus any
// bought extra base (`color:marron`, `color:noir`).
export function basesOf(owned) {
  return [...BASES, ...EXTRA_BASES.filter(k => owned.includes(`color:${k}`))];
}

// obtainable(ownedBases) -> colour keys: the bases themselves, then every colour that is one mix
// of two of them (bases first, then recipes in RECIPES order; no duplicates).
export function obtainable(ownedBases) {
  const have = new Set(ownedBases);
  const out = [...have];
  for (const [result, [a, b]] of Object.entries(RECIPES)) {
    if (have.has(a) && have.has(b) && !out.includes(result)) out.push(result);
  }
  return out;
}

// Colours of obtainable() that need a mix (not a base itself).
export function mixedColors(ownedBases) {
  const have = new Set(ownedBases);
  return obtainable(ownedBases).filter(c => !have.has(c));
}

// recipeFor(colour) -> [a, b] to mix, or null for a base / unknown colour.
export function recipeFor(color) {
  return RECIPES[color] ? [...RECIPES[color]] : null;
}
