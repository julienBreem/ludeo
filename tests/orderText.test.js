import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../jeux/stand-desserts/src/logic/catalog.js';
import {
  NOUNS, numberWord, orderWords, orderSentence, orderSentenceParts, failedElements,
} from '../jeux/stand-desserts/src/logic/orderText.js';

const keys = kind => ITEMS.filter(i => i.kind === kind).map(i => i.key);
const SHAPES = keys('shape');
const COLORS = keys('color');
const TOPPINGS = keys('topping');
const FEMININE_SHAPES = ['etoile', 'licorne'];
const order = (shape, glaze, toppings) => ({ dessert: 'gateau', shape, glaze, toppings });

// every ordered selection of 1..3 distinct colours (the zones go left to right)
function glazes() {
  const out = [];
  for (const a of COLORS) {
    out.push([a]);
    for (const b of COLORS) {
      if (b === a) continue;
      out.push([a, b]);
      for (const c of COLORS) if (c !== a && c !== b) out.push([a, b, c]);
    }
  }
  return out;
}

test('every catalog shape, colour and topping has its words', () => {
  for (const k of SHAPES) assert.ok(NOUNS.shape[k]?.word && ['m', 'f'].includes(NOUNS.shape[k].g), k);
  for (const k of COLORS) assert.ok(NOUNS.color[k]?.m && NOUNS.color[k]?.f, k);
  for (const k of TOPPINGS) {
    const t = NOUNS.topping[k];
    assert.ok(t?.one && t?.many && ['m', 'f'].includes(t.g), k);
  }
});

test('numbers in letters 1..6, « un »/« une » by gender', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(n => numberWord(n, 'm')), ['un', 'deux', 'trois', 'quatre', 'cinq', 'six']);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(n => numberWord(n, 'f')), ['une', 'deux', 'trois', 'quatre', 'cinq', 'six']);
  assert.throws(() => numberWord(7));
  assert.throws(() => numberWord(0));
});

test('reference sentences', () => {
  const cases = [
    [order('coeur', ['rose', 'violet'], [{ key: 'fraise', count: 2 }, { key: 'etoile', count: 1 }]),
      'Un cœur rose et violet, avec deux fraises et une étoile.'],
    [order('etoile', ['jaune'], [{ key: 'etoile', count: 1 }]), 'Une étoile jaune, avec une étoile.'],
    [order('licorne', ['rose', 'violet', 'blanc'], [{ key: 'bonbon', count: 1 }, { key: 'pepites', count: 3 }, { key: 'chantilly', count: 2 }]),
      'Une licorne rose, violette et blanche, avec un bonbon, trois pépites de chocolat et deux cuillères de chantilly.'],
    [order('rond', ['vert'], [{ key: 'vermicelles', count: 1 }]), 'Un rond vert, avec une poignée de vermicelles.'],
    [order('carre', ['bleu', 'blanc'], [{ key: 'vermicelles', count: 4 }, { key: 'bougie', count: 1 }]),
      'Un carré bleu et blanc, avec quatre poignées de vermicelles et une bougie.'],
    [order('etoile', ['bleu', 'vert'], [{ key: 'chantilly', count: 1 }, { key: 'bonbon', count: 2 }]),
      'Une étoile bleue et verte, avec une cuillère de chantilly et deux bonbons.'],
    [order('licorne', ['blanc'], [{ key: 'pepites', count: 1 }, { key: 'bougie', count: 6 }]),
      'Une licorne blanche, avec une pépite de chocolat et six bougies.'],
    [order('coeur', ['blanc'], [{ key: 'bonbon', count: 5 }]), 'Un cœur blanc, avec cinq bonbons.'],
  ];
  for (const [o, want] of cases) assert.equal(orderSentence(o), want);
});

test('agreement and punctuation over every shape × colour selection × topping × count', () => {
  for (const shape of SHAPES) {
    const fem = FEMININE_SHAPES.includes(shape);
    const g = fem ? 'f' : 'm';
    for (const glaze of glazes()) {
      const colourText = glaze.map(c => NOUNS.color[c][g]);
      const list = colourText.length === 1 ? colourText[0]
        : `${colourText.slice(0, -1).join(', ')} et ${colourText[colourText.length - 1]}`;
      for (const key of TOPPINGS) {
        for (let n = 1; n <= 6; n++) {
          const s = orderSentence(order(shape, glaze, [{ key, count: n }]));
          const t = NOUNS.topping[key];
          const num = n === 1 ? (t.g === 'f' ? 'une' : 'un') : numberWord(n);
          assert.equal(s, `${fem ? 'Une' : 'Un'} ${NOUNS.shape[shape].word} ${list}, avec ${num} ${n === 1 ? t.one : t.many}.`);
          assert.match(s, /^[UÉ][^.]*\.$/u, 'a capital first, one full stop at the end');
          assert.ok(!/\s{2}|\s[,.]|,\S/u.test(s), `spacing: ${s}`);
          assert.equal((s.match(/,/g) ?? []).length, glaze.length === 3 ? 2 : 1, `commas: ${s}`);
        }
      }
    }
  }
});

test('two and three topping kinds: « a et b », « a, b et c »; plural only above one', () => {
  const s2 = orderSentence(order('rond', ['rose'], [{ key: 'fraise', count: 1 }, { key: 'bougie', count: 3 }]));
  assert.equal(s2, 'Un rond rose, avec une fraise et trois bougies.');
  const s3 = orderSentence(order('rond', ['rose'], [{ key: 'bonbon', count: 2 }, { key: 'fraise', count: 1 }, { key: 'etoile', count: 2 }]));
  assert.equal(s3, 'Un rond rose, avec deux bonbons, une fraise et deux étoiles.');
  for (const key of TOPPINGS) {
    const t = NOUNS.topping[key];
    assert.ok(t.many !== t.one, `${key}: a plural form`);
  }
  assert.ok(NOUNS.topping.vermicelles.one.endsWith('vermicelles'), 'vermicelles stays plural');
});

test('an order without toppings or glaze still makes a sentence', () => {
  assert.equal(orderSentence(order('coeur', ['rose'], [])), 'Un cœur rose.');
  assert.equal(orderSentence(order('etoile', [], [{ key: 'fraise', count: 2 }])), 'Une étoile, avec deux fraises.');
});

test('sentence parts join to the sentence and tag each element once', () => {
  const o = order('licorne', ['rose', 'violet', 'jaune'], [{ key: 'fraise', count: 2 }, { key: 'etoile', count: 1 }]);
  const parts = orderSentenceParts(o);
  assert.equal(parts.map(p => p.text).join(''), orderSentence(o));
  const tagged = parts.filter(p => p.kind).map(p => `${p.kind}:${p.index}:${p.text}`);
  assert.deepEqual(tagged, ['forme:0:licorne', 'couleur:0:rose', 'couleur:1:violette', 'couleur:2:jaune',
    'topping:0:deux fraises', 'topping:1:une étoile']);
  for (let i = 1; i < parts.length; i++) assert.ok(parts[i].kind || parts[i - 1].kind, 'glue pieces are merged');
});

test('orderWords: N1 labels without numbers, N2 counts in digits, colours agree with the shape', () => {
  const o = order('etoile', ['violet', 'blanc'], [{ key: 'fraise', count: 2 }, { key: 'chantilly', count: 1 }, { key: 'vermicelles', count: 3 }]);
  assert.deepEqual(orderWords(o).map(w => `${w.kind}:${w.key}:${w.word}`), [
    'forme:etoile:étoile', 'couleur:violet:violette', 'couleur:blanc:blanche',
    'topping:fraise:fraises', 'topping:chantilly:chantilly', 'topping:vermicelles:vermicelles',
  ]);
  assert.deepEqual(orderWords(o, 2).map(w => w.word), [
    'étoile', 'violette', 'blanche', '2 fraises', '1 cuillère de chantilly', '3 poignées de vermicelles',
  ]);
  const one = order('coeur', ['vert'], [{ key: 'pepites', count: 1 }, { key: 'bonbon', count: 4 }]);
  assert.deepEqual(orderWords(one).map(w => w.word), ['cœur', 'vert', 'pépite de chocolat', 'bonbons']);
  assert.deepEqual(orderWords(one, 3).map(w => w.word), ['cœur', 'vert', '1 pépite de chocolat', '4 bonbons']);
  assert.deepEqual(orderWords(one).map(w => w.index), [0, 0, 0, 1]);
});

test('failedElements: the words tied to each failed point', () => {
  const o = order('coeur', ['rose', 'violet'], [{ key: 'fraise', count: 2 }, { key: 'etoile', count: 3 }]);
  assert.deepEqual(failedElements(o, {}), []);
  assert.deepEqual(failedElements(o, { pate: { ok: false }, cuisson: { ok: false } }), []);
  assert.deepEqual(failedElements(o, { moule: { ok: false, reason: 'mauvaise-forme' } }), [{ kind: 'forme', index: 0 }]);
  assert.deepEqual(failedElements(o, { couleur: { ok: false, zone: 1 } }), [{ kind: 'couleur', index: 1 }]);
  assert.deepEqual(failedElements(o, { couleur: { ok: false } }), [{ kind: 'couleur', index: 0 }, { kind: 'couleur', index: 1 }]);
  assert.deepEqual(failedElements(o, { toppings: { ok: false, key: 'etoile' } }), [{ kind: 'topping', index: 1 }]);
  assert.deepEqual(failedElements(o, { toppings: { ok: false, key: 'bougie' } }),
    [{ kind: 'topping', index: 0 }, { kind: 'topping', index: 1 }]);
  assert.deepEqual(failedElements(o, { moule: { ok: true }, couleur: { ok: true }, toppings: { ok: true } }), []);
});

test('orderWordParts: one line per category, led by its pictogram', async () => {
  const { orderWordParts } = await import('../jeux/stand-desserts/src/logic/orderText.js');
  const o = order('etoile', ['rose', 'vert'], [{ key: 'fraise', count: 2 }, { key: 'bonbon', count: 1 }]);
  const flat = orderWordParts(o).map(p => (p.br ? '|' : p.pict ? `[${p.pict}]` : p.text)).join('');
  assert.equal(flat, '[forme]étoile|[couleur]rose, verte|[topping]2 fraises, 1 bonbon');
  const tagged = orderWordParts(o).filter(p => p.kind).map(p => `${p.kind}:${p.index}`);
  assert.deepEqual(tagged, ['forme:0', 'couleur:0', 'couleur:1', 'topping:0', 'topping:1']);
});
