export const INGREDIENTS = ['oeuf', 'farine', 'sucre', 'beurre', 'lait', 'chocolat'];

export const DESSERTS = {
  gateau: { recipe: { oeuf: 2, farine: 1, sucre: 1, beurre: 1 }, heat: 2 },
  tarte: { recipe: { farine: 2, beurre: 1, sucre: 1 }, heat: 3 },
  cupcake: { recipe: { oeuf: 1, farine: 1, sucre: 1, lait: 1 }, heat: 1 },
};

const CATALOG = {
  shape: { rond: 0, carre: 0, coeur: 0, etoile: 8, licorne: 16 },
  color: { rose: 0, violet: 0, jaune: 0, blanc: 0, bleu: 10, vert: 12 },
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
