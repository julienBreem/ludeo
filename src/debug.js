// Debug entry: index.html?scene=<SceneKey> opens that scene directly with a sample round
// (heart gateau, golden, half rose glaze, 3 strawberries, order matching).
import { createRound } from './logic/round.js';
import { GRID } from './logic/paint.js';
import { setRound } from './game-state.js';
import { shapeMask } from './ui/cakeView.js';

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
  return { dessert: 'gateau', shape: 'coeur', color: 'rose', topping: 'fraise', toppingCount: 3 };
}

// Hard-coded sample cake (placeholders draw it too). Glaze: left half of the heart in rose.
export function sampleCake(scene) {
  const mask = shapeMask(scene, 'coeur');
  const cells = new Uint8Array(GRID * GRID);
  for (let i = 0; i < cells.length; i++) if (mask[i] && i % GRID < GRID / 2) cells[i] = 1;
  return {
    dessert: 'gateau',
    doughOk: true,
    shape: 'coeur',
    bake: 'dore',
    glaze: { cells, size: GRID, colorKeys: ['rose'] },
    toppings: [
      { key: 'fraise', x: -70, y: -40 },
      { key: 'fraise', x: 60, y: -50 },
      { key: 'fraise', x: 0, y: 60 },
    ],
  };
}

export function installSampleRound(scene) {
  const round = createRound(sampleOrder());
  round.cake = sampleCake(scene);
  round.clientVariant = 0;
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
