// The dessert stand as seen by the collection (jeux/registry.js). Pure data and functions:
// imported by the home page and by the service worker, so no window, no Phaser here.
import { PRECACHE as GAME_FILES } from './src/assets.js';
import { resetState } from './src/logic/save.js';

export const ID = 'stand-desserts';
export const CATEGORY = 'compter-observer';
// Shared settings this game applies (registry SHARED_SETTINGS; a test checks it).
export const SUPPORTS = ['rythme', 'soir'];

const DIR = `jeux/${ID}/`;

// Files to cache for offline play, relative to the site root.
export const PRECACHE = ['collection.js', ...GAME_FILES].map(f => DIR + f);

// Parent "reset this game": clears the stand's save (coins, purchases).
export function reset(storage) {
  resetState(storage);
}
