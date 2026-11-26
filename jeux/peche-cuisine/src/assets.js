import { CLIENT_LAYERS } from '../../../shared/client.js';

// The collection's client layers live in shared/ (the home draws the avatar with them), two levels up.
export const SHARED_CLIENT_DIR = '../../shared/assets/client/';

// Every SVG the game loads. `file` is relative to the game folder (jeux/peche-cuisine/);
// `w`/`h` are the sizes to rasterise at (they match each file's viewBox).
// The home icon is loaded by BootScene from shared/ (precached by the home).
export const ASSETS = [
  { key: 'fish-body', file: 'assets/fish/fish-body.svg', w: 240, h: 140 },
  { key: 'fish-details', file: 'assets/fish/fish-details.svg', w: 240, h: 140 },
  { key: 'tile-fish', file: 'assets/fish/tile-fish.svg', w: 160, h: 160 },
  { key: 'pond-bg', file: 'assets/pond/pond-bg.svg', w: 1280, h: 800 },
  { key: 'bobber', file: 'assets/pond/bobber.svg', w: 96, h: 96 },
  { key: 'rod-bambou', file: 'assets/pond/rod-bambou.svg', w: 160, h: 160 },
  { key: 'splash-ring', file: 'assets/pond/splash-ring.svg', w: 160, h: 160 },
  { key: 'scale', file: 'assets/kitchen/scale.svg', w: 240, h: 200 },
  { key: 'label', file: 'assets/kitchen/label.svg', w: 120, h: 80 },
  { key: 'cooler', file: 'assets/kitchen/cooler.svg', w: 240, h: 180 },
  { key: 'board', file: 'assets/kitchen/board.svg', w: 320, h: 200 },
  { key: 'plate', file: 'assets/kitchen/plate.svg', w: 240, h: 240 },
  { key: 'portion', file: 'assets/kitchen/portion.svg', w: 160, h: 100 },
  { key: 'knife', file: 'assets/kitchen/knife.svg', w: 160, h: 160 },
  { key: 'kitchen-bg', file: 'assets/kitchen/kitchen-bg.svg', w: 1280, h: 800 },
  { key: 'counter', file: 'assets/kitchen/counter.svg', w: 1280, h: 240 },
  { key: 'bubble', file: 'assets/kitchen/bubble.svg', w: 280, h: 200 },
  { key: 'water-bucket', file: 'assets/kitchen/water-bucket.svg', w: 160, h: 160 },
  { key: 'coin', file: 'assets/ui/coin.svg', w: 160, h: 160 },
  { key: 'icon-ok', file: 'assets/ui/icon-ok.svg', w: 160, h: 160 },
  { key: 'icon-restart', file: 'assets/ui/icon-restart.svg', w: 160, h: 160 },
  { key: 'icon-next', file: 'assets/ui/icon-next.svg', w: 160, h: 160 },
  ...[1, 2, 3, 4, 5].map(n => ({ key: `dice-${n}`, file: `assets/ui/dice-${n}.svg`, w: 96, h: 96 })),
  // clients: shared with the stand and the home's avatar (shared/assets/client/, precached by the home)
  ...CLIENT_LAYERS.map(key => ({ key, file: `${SHARED_CLIENT_DIR}${key}.svg`, w: 300, h: 300 })),
];

// Files to cache for offline play, relative to the game folder (collection.js prefixes them).
export const PRECACHE = [
  'index.html',
  'src/assets.js',
  'src/config.js',
  'src/game-state.js',
  'src/main.js',
  'src/logic/cutting.js',
  'src/logic/fish.js',
  'src/logic/fishing.js',
  'src/logic/orders.js',
  'src/logic/rng.js',
  'src/logic/round.js',
  'src/logic/save.js',
  'src/logic/scoring.js',
  'src/logic/setup.js',
  'src/logic/stock.js',
  'src/scenes/BootScene.js',
  'src/scenes/CutScene.js',
  'src/scenes/EndScene.js',
  'src/scenes/FishingScene.js',
  'src/scenes/KitchenScene.js',
  'src/scenes/PlateScene.js',
  'src/scenes/WeighScene.js',
  'src/ui/button.js',
  'src/ui/client.js',
  'src/ui/cooler.js',
  'src/ui/fishArt.js',
  'src/ui/flow.js',
  'src/ui/fx.js',
  'src/ui/pace.js',
  // the shared client layers are in the home's precache
  ...ASSETS.map(a => a.file).filter(f => !f.startsWith('../')),
];
