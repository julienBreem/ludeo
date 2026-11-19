// Loads every SVG (coin first, to draw the progress bar), makes the particle textures,
// then starts the Stand (or the debug scene given by ?debug&scene=, debug.js).
import { ASSETS } from '../assets.js';
import { W, H, COUNTER, OUTLINE } from '../config.js';
import { makeFxTextures } from '../ui/fx.js';
import { goTo } from '../ui/flow.js';
import { installSettings } from '../ui/pace.js';
import { debugSceneKey, installSampleRound } from '../debug.js';

const loadSvg = (load, a) => load.svg(a.key, a.file, { width: a.w, height: a.h });

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    loadSvg(this.load, ASSETS.find(a => a.key === 'coin'));
  }

  create() {
    installSettings(this.game.canvas); // evening filter + live settings
    const barW = 640;
    const barH = 44;
    const x0 = (W - barW) / 2;
    const y0 = H / 2 - barH / 2;
    const track = this.add.graphics();
    track.fillStyle(0xffffff, 1).fillRoundedRect(x0, y0, barW, barH, barH / 2);
    track.lineStyle(4, OUTLINE, 0.25).strokeRoundedRect(x0, y0, barW, barH, barH / 2);
    const fill = this.add.graphics();
    const coin = this.add.image(x0, H / 2, 'coin').setDisplaySize(96, 96);
    const show = (p) => {
      fill.clear();
      const w = Math.max(barH, barW * p);
      fill.fillStyle(COUNTER, 1).fillRoundedRect(x0, y0, w, barH, barH / 2);
      coin.x = x0 + w - barH / 2;
      coin.rotation = p * Math.PI * 4;
    };
    show(0);

    // The collection's shared home icon (the Stand's home button).
    this.load.svg('icon-home', '../../shared/assets/icon-home.svg', { width: 160, height: 160 });
    for (const a of ASSETS) if (!this.textures.exists(a.key)) loadSvg(this.load, a);
    this.load.on('progress', show);
    this.load.once('complete', () => {
      makeFxTextures(this);
      const key = debugSceneKey(this.game);
      if (key) {
        installSampleRound(this);
        goTo(this, key);
      } else {
        goTo(this, 'Stand');
      }
    });
    this.load.start();
  }
}
