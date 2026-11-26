// The fishing and cooking game as seen by the collection (jeux/registry.js). Pure data and
// functions: imported by the home page and by the service worker, so no window, no Phaser here.
import { PRECACHE as GAME_FILES } from './src/assets.js';
import { resetState } from './src/logic/save.js';

export const ID = 'peche-cuisine';
// Name shown to the parent (French).
export const NAME = 'Pêche et cuisine';
export const CATEGORY = 'compter-observer';
// Picture of the game's tile (relative to the game folder): a coloured fish, the home does not tint tiles.
export const TILE = 'assets/fish/tile-fish.svg';
// Shared settings this game applies (registry SHARED_SETTINGS; a test checks it).
export const SUPPORTS = ['rythme', 'soir'];

// The game's phases, in play order, each with its common theme (shared/themes.js).
// Lot 1 plays level 1 only.
export const PHASES = [
  { id: 'peche', name: 'Pêche', theme: 'logique', levels: 1 },
  { id: 'pesee', name: 'Pesée', theme: 'nombres', levels: 1 },
  { id: 'cuisine', name: 'Cuisine', theme: 'nombres', levels: 1 },
  { id: 'decoupe', name: 'Découpe', theme: 'couleurs-fractions', levels: 1 },
  { id: 'dressage', name: 'Dressage', theme: 'logique', levels: 1 },
];

const DIR = `jeux/${ID}/`;

// Files to cache for offline play, relative to the site root.
export const PRECACHE = ['collection.js', ...GAME_FILES].map(f => DIR + f);

// Parent "reset this game": clears this game's save only.
export function reset(storage) {
  resetState(storage);
}
