// The collection's games and categories. Pure data and functions: imported by the home page
// and by the service worker (sw.js). Paths are relative to the site root (where sw.js and the
// home index.html live), never absolute, so the site can live in a sub-folder.
//
// Adding a game: create jeux/<id>/collection.js (ID, NAME, CATEGORY, TILE, SUPPORTS, PHASES, PRECACHE, reset),
// import it below and add it to GAMES. tests/registry.test.js checks it.
import * as standDesserts from './stand-desserts/collection.js';
import { CLIENT_LAYERS } from '../shared/client.js';

// Settings every game must apply, like the home (tests/registry.test.js checks SUPPORTS).
export const SHARED_SETTINGS = ['rythme', 'soir'];

export const CATEGORIES = [
  { id: 'compter-observer', tile: 'shared/assets/cat-compter-observer.svg' },
];

const game = m => ({
  id: m.ID,
  name: m.NAME,
  category: m.CATEGORY,
  path: `jeux/${m.ID}/index.html`,
  tile: `jeux/${m.ID}/${m.TILE}`,
  supports: m.SUPPORTS,
  phases: m.PHASES,
  precache: m.PRECACHE,
  reset: m.reset,
});

export const GAMES = [game(standDesserts)];

// Categories that have at least one game, in CATEGORIES order, each with its games.
export function categoriesWithGames() {
  return CATEGORIES
    .map(c => ({ ...c, games: GAMES.filter(g => g.category === c.id) }))
    .filter(c => c.games.length > 0);
}

// Root files: the home, the shared modules, Phaser, the manifest and the app icons.
// Add each new shared/ module and shared/assets/ file here (tests/registry.test.js checks it).
export const HOME_PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'vendor/phaser.min.js',
  'jeux/registry.js',
  'shared/avatar-palettes.js',
  'shared/avatar.js',
  'shared/client.js',
  'shared/difficulty.js',
  'shared/effective.js',
  'shared/evening.js',
  'shared/home.css',
  'shared/history.js',
  'shared/home.js',
  'shared/pace.js',
  'shared/parent.js',
  'shared/profile.js',
  'shared/recommendations.js',
  'shared/runtime.js',
  'shared/store.js',
  'shared/themes.js',
  ...CLIENT_LAYERS.map(f => `shared/assets/client/${f}.svg`), // the avatar and the stand's clients
  'shared/assets/cat-compter-observer.svg',
  'shared/assets/home-bg-day.svg',
  'shared/assets/home-bg-evening.svg',
  'shared/assets/icon-gear.svg',
  'shared/assets/icon-home.svg',
  'shared/assets/moon.svg',
  'shared/icons/icon-192.png',
  'shared/icons/icon-512.png',
];
