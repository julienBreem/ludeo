// The dessert stand as seen by the collection (jeux/registry.js). Pure data and functions:
// imported by the home page and by the service worker, so no window, no Phaser here.
import { PRECACHE as GAME_FILES } from './src/assets.js';
import { resetState } from './src/logic/save.js';

export const ID = 'stand-desserts';
// Name shown to the parent (French).
export const NAME = 'Stand de desserts';
export const CATEGORY = 'compter-observer';
// Picture of the game's tile when its category lists several games (relative to the game folder).
export const TILE = 'assets/toppings/topping-fraise.svg';
// Shared settings this game applies (registry SHARED_SETTINGS; a test checks it).
export const SUPPORTS = ['rythme', 'soir'];

// The game's phases, in play order, each with its common theme (shared/themes.js) and the number
// of levels it plays today: `levels: 1` = not educational yet (the parent sees « bientôt », no
// proposals). `scored: false`: the phase has no point at Service (the order), so no results and
// no proposals; its level is set by hand.
export const PHASES = [
  { id: 'commande', name: 'Commande', theme: 'lecture', levels: 3, scored: false },
  { id: 'pate', name: 'Pâte', theme: 'nombres', levels: 3 },
  { id: 'moule', name: 'Moule', theme: 'geometrie', levels: 3 },
  { id: 'cuisson', name: 'Cuisson', theme: 'temps', levels: 3 },
  { id: 'couleur', name: 'Glaçage', theme: 'couleurs-fractions', levels: 3 },
  { id: 'toppings', name: 'Toppings', theme: 'logique', levels: 1 },
  { id: 'service', name: 'Service', theme: 'monnaie', levels: 1 },
];

const DIR = `jeux/${ID}/`;

// Files to cache for offline play, relative to the site root.
export const PRECACHE = ['collection.js', ...GAME_FILES].map(f => DIR + f);

// Parent "reset this game": clears the stand's save (coins, purchases).
export function reset(storage) {
  resetState(storage);
}
