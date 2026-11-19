// Debug entry: index.html?debug&scene=<SceneKey> opens that scene directly with a sample round
// (heart gateau, golden, rose | violet glaze, 2 strawberries + 3 stars, order matching).
// &score=N (0..5) also fills the round's results: the first N steps ok, the others failed
// (&alt=1 picks the other colour/topping failure reasons), e.g. ?debug&scene=Service&score=3.
// Without the debug flag ?scene= and &score= are ignored (normal start), so a shared or saved link
// cannot open a made-up round. A sample round's results are never saved for the parent's proposals,
// unless &record=1 is given too (tests: ?debug&scene=Service&score=0&record=1 counts as a played
// round at the stored levels).
// Levels: ?debug&level=<phase>:<n>,... (e.g. ?debug&level=pate:3) forces phase levels for this page
// (shared/runtime.js phaseLevels), for the sample round and every new client.
// Half hours: ?debug&half=1 lets Cuisson N3 ask for ½ h and snap the alarm to half hours.
// Order: ?debug&order=<shape>/<colours>/<toppings>[/<dessert>] (e.g. licorne/rose-violet-jaune/
// fraise:2-bougie:1-chantilly:3) gives every new client that order (game-state.js newRound), and
// the sample round of ?debug&scene= too (its ideal cake), e.g. ?debug&scene=Paint&level=couleur:3&order=
// rond/rose-violet-violet/fraise:1.
import { createRound } from './logic/round.js';
import { STEPS } from './logic/scoring.js';
import { generateClient } from '../../../shared/client.js';
import { setRound } from './game-state.js';
import { phaseLevels } from '../../../shared/runtime.js';
import { ID } from '../collection.js';
import { idealCake } from './ui/orderCake.js';
import { parseOrderParam } from './logic/order.js';

const PARAM = 'scene';

// The URL's parameters when the debug flag is on, else null.
function debugParams() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.has('debug') ? q : null;
  } catch {
    return null;
  }
}

// Valid scene key from the URL (?debug&scene=), or null (normal start).
export function debugSceneKey(game) {
  const key = debugParams()?.get(PARAM) ?? null;
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
  const q = debugParams();
  const n = q?.get('score') ?? null;
  if (n === null || !/^[0-5]$/.test(n)) return { score: null, alt: false };
  return { score: Number(n), alt: q.get('alt') === '1' };
}

export function installSampleRound(scene) {
  const order = parseOrderParam(debugParams()?.get('order') ?? null) ?? sampleOrder();
  const round = createRound(order);
  round.cake = idealCake(scene, order);
  round.client = generateClient();
  round.levels = phaseLevels(ID);
  const { score, alt } = urlScore();
  round.results = sampleResults(score, alt);
  round.sample = true; // not played: ServiceScene saves nothing of it...
  round.recordSample = debugParams()?.get('record') === '1'; // ...unless asked to (tests)
  setRound(round);
  return round;
}

// Debug only: ?debug&<name>=1 (e.g. &half=1: Cuisson N3 with ½ h durations, logic/bake.js HALF_HOURS).
export function debugFlag(name) {
  return debugParams()?.get(name) === '1';
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
