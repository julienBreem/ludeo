// Phaser game: config and scene registry.
import { W, H, BG } from './config.js';
import { installErrorLog } from './debug.js';
import { BootScene } from './scenes/BootScene.js';
import { StandScene } from './scenes/StandScene.js';
import { DoughScene } from './scenes/DoughScene.js';
import { MoldScene } from './scenes/MoldScene.js';
import { BakeScene } from './scenes/BakeScene.js';
import { PaintScene } from './scenes/PaintScene.js';
import { ToppingsScene } from './scenes/ToppingsScene.js';
import { ServiceScene } from './scenes/ServiceScene.js';
import { ShopScene } from './scenes/ShopScene.js';

if (new URLSearchParams(window.location.search).has('scene')) installErrorLog();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: BG,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 1 },
  banner: false,
  scene: [BootScene, StandScene, DoughScene, MoldScene, BakeScene, PaintScene, ToppingsScene, ServiceScene, ShopScene],
});

if (window.__errors) window.__game = game;

// Back gesture to the game after a trip home: the browser may restore this page as it was left
// (back-forward cache), with the coins, the pace and the evening look of that time, although the
// parent may have reset the game or changed the settings meanwhile. Start again from storage.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
});

// Offline play: the collection's single service worker lives at the site root (two levels up).
// Relative path so it works from a sub-folder or sub-domain; updateViaCache as in the home.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../../sw.js', { type: 'module', updateViaCache: 'none' }).catch(() => {});
  });
}
