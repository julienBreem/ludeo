// Debug entry: index.html?scene=<SceneKey> opens that scene directly with a sample round
// (heart gateau, golden, rose | violet glaze, 2 strawberries + 3 stars, order matching).
// &score=N (0..5) also fills the round's results: the first N steps ok, the others failed
// (&alt=1 picks the other colour/topping failure reasons), e.g. ?scene=Service&score=3.
// Levels: ?debug&level=<phase>:<n>,... (e.g. ?debug&level=pate:3) forces phase levels for this page
// (shared/runtime.js phaseLevels), for the sample round and every new client.
import { createRound } from './logic/round.js';
import { STEPS } from './logic/scoring.js';
import { generateClient } from '../../../shared/client.js';
import { setRound } from './game-state.js';
import { phaseLevels } from '../../../shared/runtime.js';
import { ID } from '../collection.js';
import { idealCake } from './ui/orderCake.js';

const PARAM = 'scene';

// Valid scene key from the URL, or null (normal start).
export function debugSceneKey(game) {
  let key = null;
  try {
    key = new URLSearchParams(window.location.search).get(PARAM);
  } catch {
    return null;
  }
  if (!key || key === 'Boot') return null;
  return game.scene.keys[key] ? key : null;
}

export function sampleOrder() {
  return {
    dessert: 'gateau',
    shape: 'coeur',
    glaze: ['rose', 'violet'],
    toppings: [{ key: 'fraise', count: 2 }, { key: 'etoile', count: 3 }],
  };
}

// Sample cake: the ideal cake of the sample order (placeholders draw it too).
export function sampleCake(scene) {
  return idealCake(scene, sampleOrder());
}

const FAILS = {
  pate: { ok: false, reason: 'pas-melange' },
  moule: { ok: false, reason: 'mauvaise-forme' },
  cuisson: { ok: false, reason: 'pale' },
  couleur: { ok: false, reason: 'mauvaise-couleur', zone: 1, color: 'jaune' },
  toppings: { ok: false, reason: 'trop', key: 'etoile' },
};
const ALT_FAILS = {
  couleur: { ok: false, reason: 'pas-couvert', zone: 0 },
  toppings: { ok: false, reason: 'mauvais-topping', key: 'bougie' },
};

// Results with the first `score` steps ok (null: none set).
export function sampleResults(score, alt = false) {
  if (score === null) return {};
  return Object.fromEntries(STEPS.map((s, i) => [s, i < score ? { ok: true } : ((alt && ALT_FAILS[s]) || FAILS[s])]));
}

function urlScore() {
  try {
    const q = new URLSearchParams(window.location.search);
    const n = q.get('score');
    if (n === null || !/^[0-5]$/.test(n)) return { score: null, alt: false };
    return { score: Number(n), alt: q.get('alt') === '1' };
  } catch {
    return { score: null, alt: false };
  }
}

export function installSampleRound(scene) {
  const round = createRound(sampleOrder());
  round.cake = sampleCake(scene);
  round.client = generateClient();
  round.levels = phaseLevels(ID);
  const { score, alt } = urlScore();
  round.results = sampleResults(score, alt);
  setRound(round);
  return round;
}

// Debug only: collect errors in window.__errors and mirror them on <body data-errors>.
export function installErrorLog() {
  const errors = (window.__errors = []);
  const push = (msg) => {
    errors.push(String(msg));
    document.body.dataset.errors = JSON.stringify(errors);
  };
  document.body.dataset.errors = '[]';
  window.addEventListener('error', e => push(e.message || e.error || 'error'));
  window.addEventListener('unhandledrejection', e => push(e.reason?.message ?? e.reason));
  const origError = console.error.bind(console);
  console.error = (...args) => { push(args.join(' ')); origError(...args); };
  const origWarn = console.warn.bind(console);
  console.warn = (...args) => { push(`warn: ${args.join(' ')}`); origWarn(...args); };
}
