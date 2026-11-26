// End of a round: the coin total, the open cooler with every fish and its label, and the water
// bucket. Dragging a fish into the bucket releases it (never an error, earns nothing): that is how
// a cooler full of fish that no order can use gets unblocked. ▶ plays again (a new round starts
// with the fishing), home goes back to the collection.
import { W, H, TOUCH, BG } from '../config.js';
import { addIconButton } from '../ui/button.js';
import { goTo } from '../ui/flow.js';
import { dur } from '../ui/pace.js';
import { popIn, sparkle, splash } from '../ui/fx.js';
import { coolerLayout, drawCoolerFish, drawCoolerPanel } from '../ui/cooler.js';
import { getRound, getState, updateState } from '../game-state.js';
import { gameSetup } from '../logic/setup.js';
import { releaseFish } from '../logic/stock.js';

const HOME_URL = '../../index.html';

const COINS = { x: 560, y: 100, size: 120 };
const COOLER = { left: 40, top: 230, w: 940, h: 400 };
const BUCKET = { x: 1140, y: 400, scale: 1.5, reach: 140 };
const D = { cooler: 10, bucket: 20, fish: 100, drag: 200, flying: 300, ok: 400, home: 500 };

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create() {
    // Phaser reuses the instance: every per-run field is reset here.
    this.round = getRound();
    this.level = this.round.levels.cuisine;
    this.items = [];
    this.__leaving = null;

    this.cameras.main.setBackgroundColor(BG);
    this.add.image(W / 2, H / 2, 'kitchen-bg').setDepth(0);

    const coin = this.add.image(COINS.x, COINS.y, 'coin').setDisplaySize(COINS.size, COINS.size).setDepth(D.ok);
    this.add.text(COINS.x + COINS.size / 2 + 20, COINS.y, String(getState().coins), {
      fontFamily: 'sans-serif', fontSize: '80px', color: '#ffffff', fontStyle: 'bold', stroke: '#1f2a44', strokeThickness: 8,
    }).setOrigin(0, 0.5).setDepth(D.ok);
    popIn(this, coin);
    sparkle(this, COINS.x, COINS.y);

    drawCoolerPanel(this, COOLER, D.cooler);
    this.add.image(BUCKET.x, BUCKET.y, 'water-bucket').setScale(BUCKET.scale).setDepth(D.bucket);
    this.buildCooler();

    addIconButton(this, 24 + TOUCH / 2, 24 + TOUCH / 2, 'icon-home', () => this.goHome()).setDepth(D.home);
    const again = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-next', () => goTo(this, 'Fishing'))
      .setDepth(D.ok);
    popIn(this, again);

    this.input.on('dragstart', (pointer, obj) => { if (obj.item) { this.tweens.killTweensOf(obj); obj.setDepth(D.drag); } });
    this.input.on('drag', (pointer, obj, x, y) => { if (obj.item && !obj.item.gone) obj.setPosition(x, y); });
    this.input.on('dragend', (pointer, obj) => this.onDrop(obj));
  }

  buildCooler() {
    const stock = getState().stock;
    const colors = gameSetup(getState()).colors;
    for (const { fish, x, y } of coolerLayout(stock, colors, COOLER)) {
      const c = drawCoolerFish(this, fish, x, y, this.level).setDepth(D.fish);
      c.setInteractive({ useHandCursor: true, draggable: true });
      this.input.setDraggable(c);
      const it = { fish, c, home: { x, y }, gone: false };
      c.item = it;
      this.items.push(it);
    }
  }

  onDrop(obj) {
    const it = obj.item;
    if (!it || it.gone) return;
    const d = Phaser.Math.Distance.Between(obj.x, obj.y, BUCKET.x, BUCKET.y);
    if (d <= BUCKET.reach) {
      this.release(it);
      return;
    }
    this.tweens.add({
      targets: obj, x: it.home.x, y: it.home.y, duration: dur(300), ease: 'Back.easeOut',
      onComplete: () => obj.setDepth(D.fish),
    });
  }

  // The fish leaves the cooler at once, then flips into the water with a splash.
  release(it) {
    it.gone = true;
    const c = it.c;
    c.disableInteractive();
    updateState((s) => ({ ...s, stock: releaseFish(s.stock, it.fish.id) }));
    c.setDepth(D.flying);
    this.tweens.add({
      targets: c, x: BUCKET.x, y: BUCKET.y - 40, angle: 360, scaleX: c.scaleX * 0.6, scaleY: c.scaleY * 0.6,
      duration: dur(500), ease: 'Cubic.easeInOut',
      onComplete: () => {
        splash(this, BUCKET.x, BUCKET.y - 50, 0xffffff);
        const ring = this.add.image(BUCKET.x, BUCKET.y - 30, 'splash-ring').setDepth(D.flying + 1).setScale(0.4).setAlpha(0.9);
        this.tweens.add({ targets: ring, scale: 1.1, alpha: 0, duration: dur(600), onComplete: () => ring.destroy() });
        this.tweens.add({ targets: c, alpha: 0, y: BUCKET.y, duration: dur(250), onComplete: () => c.destroy() });
      },
    });
  }

  // Fades out, then opens the collection home (the game is two levels below it).
  goHome() {
    if (this.__leaving) return;
    this.__leaving = {};
    this.cameras.main.once('camerafadeoutcomplete', () => { window.location.href = HOME_URL; });
    this.cameras.main.fadeOut(250);
  }
}
