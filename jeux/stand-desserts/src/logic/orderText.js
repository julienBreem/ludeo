// The order in French words, for the reading levels of the Commande phase (theme `lecture`).
// N1: one label per element of the picture (shape, each glaze colour, each kind of topping).
// N2: the same words, toppings counted in digits (« 2 fraises »).
// N3: one sentence, numbers in letters (« Un cœur rose et violet, avec deux fraises et une étoile. »).
// Glaze colours describe the cake, so they agree with the shape's noun (« une étoile violette »).
// The dessert (gâteau, tarte, cupcake) is visible on the cake's flank and is never named.
// Toppings N2 (motif) and N3 (hint card) orders are not counted at Commande N2 / N3: the count is
// the exercise. A motif reads « une couronne de fraises et d'étoiles »; a hint card lists the kinds
// (« fraises, étoiles » in the words, « des fraises et des étoiles » in the sentence).

// g: grammatical gender of the noun ('m' | 'f').
// Toppings: `one` / `many` are the counted forms (« une fraise », « deux fraises »); `label` is the
// N1 word (no number) when it differs from the counted form, by count: [one, many]; `some` names
// the kind without a number, in a sentence (« des fraises », « de la chantilly »).
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
    rose: { m: 'rose', f: 'rose', mp: 'roses' },
    violet: { m: 'violet', f: 'violette', mp: 'violets' },
    jaune: { m: 'jaune', f: 'jaune', mp: 'jaunes' },
    blanc: { m: 'blanc', f: 'blanche', mp: 'blancs' },
    bleu: { m: 'bleu', f: 'bleue', mp: 'bleus' },
    vert: { m: 'vert', f: 'verte', mp: 'verts' },
    // Glaçage N2-N3 bases and mixes; « bleu clair » (compound colour) and « marron » / « orange »
    // (nouns used as colours) do not agree
    rouge: { m: 'rouge', f: 'rouge', mp: 'rouges' },
    orange: { m: 'orange', f: 'orange', mp: 'orange' },
    bleuclair: { m: 'bleu clair', f: 'bleu clair', mp: 'bleu clair' },
    beige: { m: 'beige', f: 'beige', mp: 'beiges' },
    gris: { m: 'gris', f: 'grise', mp: 'gris' },
    marron: { m: 'marron', f: 'marron', mp: 'marron' },
    noir: { m: 'noir', f: 'noire', mp: 'noirs' },
  },
  topping: {
    fraise: { one: 'fraise', many: 'fraises', g: 'f', some: 'des fraises' },
    pepites: { one: 'pépite de chocolat', many: 'pépites de chocolat', g: 'f', some: 'des pépites de chocolat' },
    // always plural: counted by the handful
    vermicelles: { one: 'poignée de vermicelles', many: 'poignées de vermicelles', g: 'f', label: ['vermicelles', 'vermicelles'], some: 'des vermicelles' },
    bougie: { one: 'bougie', many: 'bougies', g: 'f', some: 'des bougies' },
    etoile: { one: 'étoile', many: 'étoiles', g: 'f', some: 'des étoiles' },
    bonbon: { one: 'bonbon', many: 'bonbons', g: 'm', some: 'des bonbons' },
    // uncountable: counted by the spoonful
    chantilly: { one: 'cuillère de chantilly', many: 'cuillères de chantilly', g: 'f', label: ['chantilly', 'chantilly'], some: 'de la chantilly' },
  },
};

const NUMBERS = [null, null, 'deux', 'trois', 'quatre', 'cinq', 'six'];

// Glaçage N3: a colour over several adjacent bands is read as a fraction of the cake. The colour
// agrees with the fraction's noun, plural included: « une moitié violette », « un tiers violet »,
// « deux tiers violets », « trois quarts verts », « deux tiers roses ». Invariable colours (orange,
// marron, bleu clair) stay as they are.
export const FRACTIONS = {
  '1/2': { text: 'une moitié', g: 'f' },
  '1/3': { text: 'un tiers', g: 'm' },
  '2/3': { text: 'deux tiers', g: 'm', plural: true },
  '1/4': { text: 'un quart', g: 'm' },
  '3/4': { text: 'trois quarts', g: 'm', plural: true },
};

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/**
 * colorRuns(glaze) -> Array<{key, start, bands: number[], fraction: '1/3'|...}>
 * Adjacent bands of the same colour, left to right; fraction = the run's share of the bands, reduced.
 */
export function colorRuns(glaze = []) {
  const runs = [];
  glaze.forEach((key, i) => {
    const last = runs[runs.length - 1];
    if (last && last.key === key) last.bands.push(i);
    else runs.push({ key, start: i, bands: [i] });
  });
  for (const r of runs) {
    const d = gcd(r.bands.length, glaze.length);
    r.fraction = `${r.bands.length / d}/${glaze.length / d}`;
  }
  return runs;
}

// True when a colour covers several bands (Glaçage N3): the colours are then read as fractions.
export const hasFractions = (glaze = []) => colorRuns(glaze).length < glaze.length;

// The colour words of the order: one per band (« rose », « violette »), or one per run with its
// fraction when a colour covers several bands (« un tiers rose », « deux tiers violet »). `index`
// is the run's first band, `bands` every band it covers.
function colorItems(glaze, g) {
  if (!hasFractions(glaze)) return glaze.map((key, index) => ({ key, index, bands: [index], word: colorWord(key, g) }));
  return colorRuns(glaze).map((r) => {
    const f = FRACTIONS[r.fraction];
    const word = f ? `${f.text} ${colorWord(r.key, f.g, f.plural)}` : colorWord(r.key, g);
    return { key: r.key, index: r.start, bands: r.bands, word };
  });
}

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
const colorWord = (key, g, plural = false) => (plural ? NOUNS.color[key]?.mp : NOUNS.color[key]?.[g]) ?? key;
const toppingNoun = key => NOUNS.topping[key] ?? { one: key, many: `${key}s`, g: 'm' };
const counted = (t, count) => (count === 1 ? t.one : t.many);
// the kind without a number, plural: « fraises », « vermicelles », « chantilly »
const kindWord = t => (t.label ? t.label[1] : t.many);
const someWord = t => t.some ?? `des ${kindWord(t)}`;
// « de fraises », « d'étoiles »
const ofWord = (t) => {
  const w = kindWord(t);
  return /^[aeiouyéèêàâîïôû]/iu.test(w) ? `d'${w}` : `de ${w}`;
};
// « a », « a et b », « a, b et c »
const listText = items => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`);

// Toppings N2 / N3 orders at Commande N2 / N3 (no counts) or a hidden list (« ? »), else null:
// the topping parts of the words (`sentence` false) or of the sentence.
function uncountedToppings(order, sentence, hideToppings) {
  const list = order.toppings ?? [];
  if (!list.length) return null;
  if (hideToppings) return [{ text: '?', kind: 'topping', key: null, index: 0 }];
  if (order.toppingMode === 'motif') {
    // the whole ring is one element: « une couronne de fraises et d'étoiles »
    return [{ text: motifText(order), kind: 'topping', key: list[0].key, index: 0 }];
  }
  if (order.toppingMode === 'hints') {
    return list.map(({ key }, index) => {
      const t = toppingNoun(key);
      return { text: sentence ? someWord(t) : kindWord(t), kind: 'topping', key, index };
    });
  }
  return null;
}

/**
 * motifText(order) -> « une couronne de fraises et d'étoiles » (the kinds of a motif order, in the
 * order they come in the motif), or '' for an order without toppings.
 */
export function motifText(order) {
  const list = order.toppings ?? [];
  return list.length ? `une couronne ${listText(list.map(t => ofWord(toppingNoun(t.key))))}` : '';
}

/**
 * orderWords(order, level = 1, {hideShape, hideToppings}) -> Array<{key, kind: 'forme'|'couleur'|'topping', word, index}>
 * One word per element, in the order shape, colours (zones left to right), toppings.
 * Level 1: toppings named without a number (« fraises »); level ≥ 2: « 2 fraises », but a motif
 * order is one word « une couronne de fraises et d'étoiles » (index 0) and a hint-card order
 * names the kinds only, in the plural, at every level (« fraises »). hideToppings (Toppings N2-N3 strip): one word « ? ».
 * `index` is the zone index for colours, the position in order.toppings for toppings, 0 for the shape.
 * When a colour covers several adjacent bands (Glaçage N3) there is one word per colour, as a
 * fraction (« un tiers rose », « deux tiers violet »): `index` is its first band, `bands` all of them.
 */
export function orderWords(order, level = 1, { hideShape = false, hideToppings = false } = {}) {
  const shape = shapeOf(order, hideShape);
  const out = [{ key: order.shape, kind: 'forme', word: shape.word, index: 0 }];
  for (const c of colorItems(order.glaze ?? [], shape.g)) out.push({ key: c.key, kind: 'couleur', word: c.word, index: c.index, bands: c.bands });
  // a hint-card order names its kinds in the plural at every level (« fraise » would tell a count of 1)
  const uncounted = level >= 2 || hideToppings || order.toppingMode === 'hints' ? uncountedToppings(order, false, hideToppings) : null;
  if (uncounted) {
    for (const p of uncounted) out.push({ key: p.key, kind: 'topping', word: p.text, index: p.index });
    return out;
  }
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
 * orderSentenceParts(order, {hideShape, hideToppings}) -> Array<{text, kind?, key?, index?}>
 * The N3 sentence cut into pieces: the words that name an element carry its kind/key/index (so
 * one can be highlighted), the glue between them (articles, commas, « et », « avec ») does not.
 * Joining every `text` gives orderSentence(order).
 */
export function orderSentenceParts(order, { hideShape = false, hideToppings = false } = {}) {
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
    // « Un cœur rose et violet », « Un cœur, un tiers rose et deux tiers violet »
    glue(hasFractions(glaze) ? ', ' : ' ');
    listInto(colorItems(glaze, shape.g).map(c => ({ text: c.word, kind: 'couleur', key: c.key, index: c.index })));
  }
  const toppings = order.toppings ?? [];
  const uncounted = uncountedToppings(order, true, hideToppings);
  if (uncounted) {
    glue(', avec ');
    listInto(uncounted);
  } else if (toppings.length) {
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
 * failing zone's colour word (its run's first band with fractions; every colour if the zone is unknown); toppings -> the topping kind named
 * by the result when it is in the order, else every topping (a motif order: its one word). Dough and bake have no word.
 */
export function failedElements(order, results = {}) {
  const out = [];
  if (results.moule && !results.moule.ok) out.push({ kind: 'forme', index: 0 });
  const c = results.couleur;
  if (c && !c.ok) {
    // the colour word of the failing zone (with fractions: the word of the run holding it)
    const items = colorItems(order.glaze ?? [], 'm');
    const hit = Number.isInteger(c.zone) ? items.find(it => it.bands.includes(c.zone)) : null;
    if (hit) out.push({ kind: 'couleur', index: hit.index });
    else for (const it of items) out.push({ kind: 'couleur', index: it.index });
  }
  const t = results.toppings;
  if (t && !t.ok) {
    const list = order.toppings ?? [];
    const i = order.toppingMode === 'motif' ? 0 : list.findIndex(x => x.key === t.key);
    if (i >= 0) out.push({ kind: 'topping', index: i });
    else list.forEach((_, index) => out.push({ kind: 'topping', index }));
  }
  return out;
}

/**
 * orderWordParts(order, {hideShape, hideToppings}) -> parts for a word list by category (N2 strip and Service recap):
 * [{pict: 'forme'}, shape word, {br}, {pict: 'couleur'}, colours « , »-separated, {br},
 *  {pict: 'topping'}, toppings counted in digits]. Word parts carry kind/key/index like
 * orderSentenceParts; empty categories are left out.
 */
export function orderWordParts(order, { hideShape = false, hideToppings = false } = {}) {
  const words = orderWords(order, 2, { hideShape, hideToppings });
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
