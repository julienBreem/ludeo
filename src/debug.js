// Debug entry: index.html?scene=<SceneKey> opens that scene directly with a sample round
// (heart gateau, golden, rose | violet glaze, 2 strawberries + 3 stars, order matching).
import { createRound } from './logic/round.js';
import { generateClient } from './logic/client.js';
import { setRound } from './game-state.js';
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

export function installSampleRound(scene) {
  const round = createRound(sampleOrder());
  round.cake = sampleCake(scene);
  round.client = generateClient();
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
