// The order in French words, for the reading levels of the Commande phase (theme `lecture`).
// N1: one label per element of the picture (shape, each glaze colour, each kind of topping).
// N2: the same words, toppings counted in digits (« 2 fraises »).
// N3: one sentence, numbers in letters (« Un cœur rose et violet, avec deux fraises et une étoile. »).
// Glaze colours describe the cake, so they agree with the shape's noun (« une étoile violette »).
// The dessert (gâteau, tarte, cupcake) is visible on the cake's flank and is never named.

// g: grammatical gender of the noun ('m' | 'f').
// Toppings: `one` / `many` are the counted forms (« une fraise », « deux fraises »); `label` is the
// N1 word (no number) when it differs from the counted form, by count: [one, many].
export const NOUNS = {
  shape: {
    rond: { word: 'rond', g: 'm' },
    carre: { word: 'carré', g: 'm' },
    coeur: { word: 'cœur', g: 'm' },
    etoile: { word: 'étoile', g: 'f' },
    licorne: { word: 'licorne', g: 'f' },
    triangle: { word: 'triangle', g: 'm' },
    rectangle: { word: 'rectangle', g: 'm' },
    ovale: { word: 'ovale', g: 'm' },
    losange: { word: 'losange', g: 'm' },
    hexagone: { word: 'hexagone', g: 'm' },
  },
  color: {
    rose: { m: 'rose', f: 'rose' },
    violet: { m: 'violet', f: 'violette' },
    jaune: { m: 'jaune', f: 'jaune' },
    blanc: { m: 'blanc', f: 'blanche' },
    bleu: { m: 'bleu', f: 'bleue' },
    vert: { m: 'vert', f: 'verte' },
  },
  topping: {
    fraise: { one: 'fraise', many: 'fraises', g: 'f' },
    pepites: { one: 'pépite de chocolat', many: 'pépites de chocolat', g: 'f' },
    // always plural: counted by the handful
    vermicelles: { one: 'poignée de vermicelles', many: 'poignées de vermicelles', g: 'f', label: ['vermicelles', 'vermicelles'] },
    bougie: { one: 'bougie', many: 'bougies', g: 'f' },
    etoile: { one: 'étoile', many: 'étoiles', g: 'f' },
    bonbon: { one: 'bonbon', many: 'bonbons', g: 'm' },
    // uncountable: counted by the spoonful
    chantilly: { one: 'cuillère de chantilly', many: 'cuillères de chantilly', g: 'f', label: ['chantilly', 'chantilly'] },
  },
};

const NUMBERS = [null, null, 'deux', 'trois', 'quatre', 'cinq', 'six'];

// A number in letters (1..6), agreeing with the noun's gender for 1.
export function numberWord(n, g = 'm') {
  if (n === 1) return g === 'f' ? 'une' : 'un';
  const w = NUMBERS[n];
  if (!w) throw new RangeError(`no number word for ${n}`);
  return w;
}

const shapeNoun = key => NOUNS.shape[key] ?? { word: key, g: 'm' };
// Moule N2-N3 (hideShape): « ? » for the shape, and the masculine forms around it (article,
// colours), so that « Une … violette » does not tell an étoile or a licorne.
const HIDDEN = { word: '?', g: 'm' };
const shapeOf = (order, hideShape) => (hideShape ? HIDDEN : shapeNoun(order.shape));
const colorWord = (key, g) => NOUNS.color[key]?.[g] ?? key;
const toppingNoun = key => NOUNS.topping[key] ?? { one: key, many: `${key}s`, g: 'm' };
const counted = (t, count) => (count === 1 ? t.one : t.many);

/**
 * orderWords(order, level = 1, {hideShape}) -> Array<{key, kind: 'forme'|'couleur'|'topping', word, index}>
 * One word per element, in the order shape, colours (zones left to right), toppings.
 * Level 1: toppings named without a number (« fraises »); level ≥ 2: « 2 fraises ».
 * `index` is the zone index for colours, the position in order.toppings for toppings, 0 for the shape.
 */
export function orderWords(order, level = 1, { hideShape = false } = {}) {
  const shape = shapeOf(order, hideShape);
  const out = [{ key: order.shape, kind: 'forme', word: shape.word, index: 0 }];
  (order.glaze ?? []).forEach((key, index) => out.push({ key, kind: 'couleur', word: colorWord(key, shape.g), index }));
  (order.toppings ?? []).forEach(({ key, count }, index) => {
    const t = toppingNoun(key);
    const word = level >= 2
      ? `${count} ${counted(t, count)}`
      : (t.label ? t.label[count === 1 ? 0 : 1] : counted(t, count));
    out.push({ key, kind: 'topping', word, index });
  });
  return out;
}

/**
 * orderSentenceParts(order, {hideShape}) -> Array<{text, kind?, key?, index?}>
 * The N3 sentence cut into pieces: the words that name an element carry its kind/key/index (so
 * one can be highlighted), the glue between them (articles, commas, « et », « avec ») does not.
 * Joining every `text` gives orderSentence(order).
 */
export function orderSentenceParts(order, { hideShape = false } = {}) {
  const shape = shapeOf(order, hideShape);
  const article = shape.g === 'f' ? 'Une' : 'Un';
  const parts = [{ text: `${article} ` }, { text: shape.word, kind: 'forme', key: order.shape, index: 0 }];
  const glue = text => parts.push({ text });
  // « a », « a et b », « a, b et c »
  const listInto = (items) => {
    items.forEach((item, i) => {
      if (i > 0) glue(i === items.length - 1 ? ' et ' : ', ');
      parts.push(item);
    });
  };
  const glaze = order.glaze ?? [];
  if (glaze.length) {
    glue(' ');
    listInto(glaze.map((key, index) => ({ text: colorWord(key, shape.g), kind: 'couleur', key, index })));
  }
  const toppings = order.toppings ?? [];
  if (toppings.length) {
    glue(', avec ');
    listInto(toppings.map(({ key, count }, index) => {
      const t = toppingNoun(key);
      return { text: `${numberWord(count, t.g)} ${counted(t, count)}`, kind: 'topping', key, index };
    }));
  }
  glue('.');
  // merge neighbouring glue pieces
  const merged = [];
  for (const p of parts) {
    const last = merged[merged.length - 1];
    if (last && !last.kind && !p.kind) last.text += p.text;
    else merged.push({ ...p });
  }
  return merged;
}

/** orderSentence(order) -> string, e.g. « Un cœur rose et violet, avec deux fraises et une étoile. » */
export function orderSentence(order) {
  return orderSentenceParts(order).map(p => p.text).join('');
}

/**
 * failedElements(order, results) -> Array<{kind, index}>
 * The order's elements tied to a failed point at Service: moule -> the shape; couleur -> the
 * failing zone's colour (every colour if the zone is unknown); toppings -> the topping kind named
 * by the result when it is in the order, else every topping. Dough and bake have no word.
 */
export function failedElements(order, results = {}) {
  const out = [];
  if (results.moule && !results.moule.ok) out.push({ kind: 'forme', index: 0 });
  const c = results.couleur;
  if (c && !c.ok) {
    const n = (order.glaze ?? []).length;
    if (Number.isInteger(c.zone) && c.zone >= 0 && c.zone < n) out.push({ kind: 'couleur', index: c.zone });
    else for (let i = 0; i < n; i++) out.push({ kind: 'couleur', index: i });
  }
  const t = results.toppings;
  if (t && !t.ok) {
    const list = order.toppings ?? [];
    const i = list.findIndex(x => x.key === t.key);
    if (i >= 0) out.push({ kind: 'topping', index: i });
    else list.forEach((_, index) => out.push({ kind: 'topping', index }));
  }
  return out;
}

/**
 * orderWordParts(order, {hideShape}) -> parts for a word list by category (N2 strip and Service recap):
 * [{pict: 'forme'}, shape word, {br}, {pict: 'couleur'}, colours « , »-separated, {br},
 *  {pict: 'topping'}, toppings counted in digits]. Word parts carry kind/key/index like
 * orderSentenceParts; empty categories are left out.
 */
export function orderWordParts(order, { hideShape = false } = {}) {
  const words = orderWords(order, 2, { hideShape });
  const out = [];
  for (const kind of ['forme', 'couleur', 'topping']) {
    const list = words.filter(w => w.kind === kind);
    if (!list.length) continue;
    if (out.length) out.push({ br: true });
    out.push({ pict: kind });
    list.forEach((w, i) => {
      if (i > 0) out.push({ text: ', ' });
      out.push({ text: w.word, kind: w.kind, key: w.key, index: w.index });
    });
  }
  return out;
}
