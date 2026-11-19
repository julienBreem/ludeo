import { SHAPE_PROPS, clueHolds, cluesFor } from './shapes.js';
import { cutTangram } from './tangram.js';

// N1 « piège proche »: for every shape, the shapes that look most like it (one is offered when
// she owns it). Polygons: same number of corners, or a pointed / round look alike; fun shapes:
// a shape sharing part of the outline (the heart's round top / pointed bottom, the star's points),
// the unicorn has no geometric twin and gets the other fun shapes.
export const CLOSE = {
  rond: ['ovale', 'hexagone'], ovale: ['rond', 'hexagone'],
  carre: ['rectangle', 'losange'], rectangle: ['carre', 'losange'], losange: ['carre', 'rectangle', 'triangle'],
  triangle: ['losange'], hexagone: ['rond', 'ovale'],
  coeur: ['rond', 'triangle'], etoile: ['hexagone', 'losange'], licorne: ['coeur', 'etoile'],
};
const ALL = Object.keys(SHAPE_PROPS);
const pick = (list, rng) => list[Math.floor(rng() * list.length)];

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// n shapes from the candidates (owned first, then every shape when owned is too few).
function takeOthers(cands, owned, n, rng) {
  const out = shuffle(cands.filter(s => owned.includes(s)), rng).slice(0, n);
  if (out.length < n) out.push(...shuffle(cands.filter(s => !out.includes(s)), rng).slice(0, n - out.length));
  return out;
}

/**
 * makeMoldExercise(order, level, owned, rng, opts?) -> { choices, clue, pieces }
 * `owned` is the list of owned shape keys (ownedKeys(owned, 'shape')). N3 pieces need
 * opts = { mask, size } (the target's top-down silhouette); without it pieces stays null.
 */
export function makeMoldExercise(order, level, owned, rng = Math.random, opts = {}) {
  const target = order.shape;
  const others = ALL.filter(s => s !== target);
  let clue = null;
  let pieces = null;
  let distractors;
  if (level === 2) {
    clue = pick(cluesFor(target), rng);
    distractors = takeOthers(others.filter(s => !clueHolds(clue, s)), owned, 3, rng);
  } else {
    const close = (CLOSE[target] ?? []).filter(s => owned.includes(s));
    const first = close.length ? [pick(close, rng)] : [];
    distractors = [...first, ...takeOthers(others.filter(s => !first.includes(s)), owned, 3 - first.length, rng)];
    if (level === 3 && opts.mask) pieces = cutTangram(opts.mask, opts.size, target, rng);
  }
  return { choices: shuffle([target, ...distractors], rng), clue, pieces };
}
