import { EXTRA_BASES } from './colors.js';

export const INGREDIENTS = ['oeuf', 'farine', 'sucre', 'beurre', 'lait', 'chocolat'];

export const DESSERTS = {
  gateau: { recipe: { oeuf: 2, farine: 1, sucre: 1, beurre: 1 }, heat: 2 },
  tarte: { recipe: { farine: 2, beurre: 1, sucre: 1 }, heat: 3 },
  cupcake: { recipe: { oeuf: 1, farine: 1, sucre: 1, lait: 1 }, heat: 1 },
};

const CATALOG = {
  shape: { rond: 0, carre: 0, coeur: 0, triangle: 0, rectangle: 0, ovale: 0, etoile: 8, licorne: 16, losange: 10, hexagone: 14 },
  // marron and noir are bases for the Glaçage N2-N3 mixes: the shop only offers them at those
  // levels (and bleu / vert, ready-made colours, only at N1).
  color: { rose: 0, violet: 0, jaune: 0, blanc: 0, bleu: 10, vert: 12, marron: 12, noir: 14 },
  topping: { fraise: 0, pepites: 0, vermicelles: 0, bougie: 0, etoile: 8, bonbon: 12, chantilly: 14 },
  deco: { guirlande: 10, auvent: 15, pancarte: 20 },
};

export const ITEMS = Object.entries(CATALOG).flatMap(([kind, keys]) =>
  Object.entries(keys).map(([key, price]) => ({ id: `${kind}:${key}`, kind, key, price })));

export function starterOwned() {
  return ITEMS.filter(i => i.price === 0).map(i => i.id);
}

export function ownedKeys(owned, kind) {
  return ITEMS.filter(i => i.kind === kind && owned.includes(i.id)).map(i => i.key);
}

export function itemById(id) {
  return ITEMS.find(i => i.id === id);
}

// The items the shop shows for a kind: everything with a price; colours by the Glaçage level
// (N1 ready-made colours, N2-N3 the bases to mix: EXTRA_BASES).
export function shopItems(kind, colorLevel = 1) {
  const items = ITEMS.filter(i => i.kind === kind && i.price > 0);
  if (kind !== 'color') return items;
  return items.filter(i => EXTRA_BASES.includes(i.key) === colorLevel >= 2);
}
