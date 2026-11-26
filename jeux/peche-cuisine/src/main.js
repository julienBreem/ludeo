// Phaser game: config and scene registry.
import { W, H, BG } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { FishingScene } from './scenes/FishingScene.js';
import { WeighScene } from './scenes/WeighScene.js';
import { KitchenScene } from './scenes/KitchenScene.js';
import { CutScene } from './scenes/CutScene.js';
import { PlateScene } from './scenes/PlateScene.js';
import { EndScene } from './scenes/EndScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: BG,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 1 },
  banner: false,
  scene: [BootScene, FishingScene, WeighScene, KitchenScene, CutScene, PlateScene, EndScene],
});

// Debug only (?debug): the game object, for scripted checks in the browser console.
if (new URLSearchParams(window.location.search).has('debug')) window.__game = game;

// Back gesture to the game after a trip home: the browser may restore this page as it was left
// (back-forward cache), with the pace and the evening look of that time, although the parent
// may have changed the settings or reset the game meanwhile. Start again from storage.
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
