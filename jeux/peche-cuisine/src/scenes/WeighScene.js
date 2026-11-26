// Weighing at level 1. The caught fish wait in a basket; she drags the next one onto the scale.
// Dots light up one by one to its weight, then a label (digit + dice) slides in and sticks on the
// fish. The fish is saved in the cooler at that moment; if the cooler is full it flips into the
// water bucket instead (no penalty, not an error). After the last fish: coins fly to the counter.
import { W, H, TOUCH, BG } from '../config.js';
import { addIconButton } from '../ui/button.js';
import { goTo } from '../ui/flow.js';
import { dur } from '../ui/pace.js';
import { popIn, sparkle, splash } from '../ui/fx.js';
import { drawFish } from '../ui/fishArt.js';
import { getRound, getState, updateState } from '../game-state.js';
import { gameSetup } from '../logic/setup.js';
import { drawWeight } from '../logic/fish.js';
import { addFish, ofColor } from '../logic/stock.js';
import { newFish } from '../logic/save.js';
import { prepCoins } from '../logic/scoring.js';

const HOME_URL = '../../index.html';

const SCALE = { x: 640, y: 540, size: 1.5 };
const SCALE_FISH = { x: 640, y: 440 };
const DROP = { halfW: 220, halfH: 190 }; // drop zone around the scale
const DOTS = { y: 320, gap: 64, max: 5 };
const BASKET = { left: 40, top: 610, w: 600, h: 170, firstX: 130, gap: 135, y: 690 };
const COOLER = { x: 1090, y: 600, scale: 1.2 };
const BUCKET = { x: 1100, y: 290 };
const COUNTER = { x: W - 110, y: 70 };
const MIN_HIT = 110; // px on screen, above the 96 px minimum
const D = { scale: 10, basket: 20, fish: 100, drag: 200, dots: 30, flying: 300, ok: 400, home: 500 };

export class WeighScene extends Phaser.Scene {
  constructor() {
    super('Weigh');
  }

  create() {
    // Phaser reuses the instance: every per-run field is reset here.
    this.round = getRound();
    this.level = this.round.levels.cuisine; // weights follow the Cuisine level
    this.capacity = gameSetup(getState()).capacity;
    this.items = [];
    this.next = 0;
    this.phase = 'idle'; // idle | busy | done
    this.dots = [];
    this.coinText = null;
    this.__leaving = null;

    this.cameras.main.setBackgroundColor(BG);
    this.add.image(W / 2, H / 2, 'kitchen-bg').setDepth(0);

    this.buildScene();
    this.buildBasket();

    addIconButton(this, 24 + TOUCH / 2, 24 + TOUCH / 2, 'icon-home', () => this.goHome()).setDepth(D.home);

    this.input.on('drag', (pointer, obj, x, y) => {
      if (obj === this.current()?.c && this.phase === 'idle') obj.setPosition(x, y);
    });
    this.input.on('dragend', (pointer, obj) => this.onDrop(obj));

    if (this.items.length === 0) this.finish();
    else this.activate();
  }

  // ---- layout ----

  buildScene() {
    this.add.image(SCALE.x, SCALE.y, 'scale').setScale(SCALE.size).setDepth(D.scale);
    for (let i = 0; i < DOTS.max; i++) {
      const x = SCALE.x + (i - (DOTS.max - 1) / 2) * DOTS.gap;
      const dot = this.add.circle(x, DOTS.y, 22, 0xcfd8dc).setStrokeStyle(4, 0x607d8b).setDepth(D.dots);
      this.dots.push(dot);
    }
    this.add.image(COOLER.x, COOLER.y, 'cooler').setScale(COOLER.scale).setDepth(D.scale);
    this.add.image(BUCKET.x, BUCKET.y, 'water-bucket').setScale(1.3).setDepth(D.scale);
  }

  buildBasket() {
    this.add.graphics().setDepth(D.basket)
      .fillStyle(0x8d6e63, 1).fillRoundedRect(BASKET.left, BASKET.top, BASKET.w, BASKET.h, 28)
      .lineStyle(8, 0x5d4037, 1).strokeRoundedRect(BASKET.left, BASKET.top, BASKET.w, BASKET.h, 28);
    const caught = Array.from(this.round.caught).filter(Boolean);
    caught.forEach((info, i) => {
      const x = BASKET.firstX + i * BASKET.gap;
      const c = drawFish(this, x, BASKET.y, info).setDepth(D.fish);
      const base = c.scaleX;
      c.setSize(Math.max(240, MIN_HIT / base), Math.max(140, MIN_HIT / base));
      this.items.push({ c, info, home: { x, y: BASKET.y }, base, done: false });
    });
  }

  current() {
    return this.items[this.next] ?? null;
  }

  // Only the next fish can be dragged; it wiggles to say so.
  activate() {
    const it = this.current();
    if (!it) return;
    it.c.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(it.c);
    it.c.setDepth(D.fish + 1);
    it.wiggle = this.tweens.add({
      targets: it.c, angle: { from: -6, to: 6 }, duration: dur(450), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  stopWiggle(it) {
    if (it.wiggle) { it.wiggle.remove(); it.wiggle = null; }
    it.c.setAngle(0);
  }

  // ---- drag and weigh ----

  onDrop(obj) {
    const it = this.current();
    if (!it || obj !== it.c || this.phase !== 'idle') return;
    const onScale = Math.abs(obj.x - SCALE.x) < DROP.halfW && Math.abs(obj.y - SCALE.y) < DROP.halfH;
    if (!onScale) {
      this.tweens.add({ targets: obj, x: it.home.x, y: it.home.y, duration: dur(300), ease: 'Back.easeOut' });
      return;
    }
    this.phase = 'busy';
    this.stopWiggle(it);
    obj.disableInteractive();
    this.tweens.add({
      targets: obj, x: SCALE_FISH.x, y: SCALE_FISH.y, duration: dur(200), ease: 'Quad.easeOut',
      onComplete: () => this.weigh(it),
    });
  }

  weigh(it) {
    // The weight follows the colour's current stock; it is fixed now so the dots can count to it,
    // and saved with the fish at the moment the label sticks.
    const have = ofColor(getState().stock, it.info.color).map((f) => f.weight);
    const weight = drawWeight(it.info.size, this.level, have, Math.random);
    const light = (i) => {
      if (i >= weight) {
        this.time.delayedCall(dur(350), () => this.attachLabel(it, weight));
        return;
      }
      const dot = this.dots[i];
      dot.setFillStyle(0xffd600);
      this.tweens.add({ targets: dot, scale: 1.3, duration: dur(120), yoyo: true });
      this.time.delayedCall(dur(350), () => light(i + 1));
    };
    light(0);
  }

  buildTag(weight) {
    const tag = this.add.container(0, 0);
    tag.add(this.add.image(0, 0, 'label').setScale(1.1));
    tag.add(this.add.text(-30, 0, String(weight), {
      fontFamily: 'sans-serif', fontSize: '44px', color: '#1f2a44', fontStyle: 'bold',
    }).setOrigin(0.5));
    tag.add(this.add.image(30, 0, `dice-${weight}`).setDisplaySize(44, 44));
    return tag;
  }

  attachLabel(it, weight) {
    const c = it.c;
    const tag = this.buildTag(weight);
    c.add(tag);
    c.tag = tag;
    tag.setPosition(0, -260 / c.scaleX);
    this.tweens.add({
      targets: tag, y: 70, duration: dur(450), ease: 'Back.easeOut',
      onComplete: () => this.stick(it, weight),
    });
  }

  // The label sticks: draw the fish into the cooler (or release it if the cooler is full).
  stick(it, weight) {
    let released = false;
    updateState((s) => {
      const made = newFish(s, it.info, weight);
      const added = addFish(made.state.stock, made.fish, this.capacity);
      released = added.released;
      return { ...made.state, stock: added.stock };
    });
    it.done = true;
    popIn(this, it.c.tag);
    this.time.delayedCall(dur(700), () => (released ? this.flyToBucket(it) : this.flyToCooler(it)));
  }

  resetDots() {
    this.dots.forEach((d) => d.setFillStyle(0xcfd8dc));
  }

  flyToCooler(it) {
    const c = it.c;
    c.setDepth(D.flying);
    this.tweens.add({
      targets: c, x: COOLER.x, y: COOLER.y - 20, scaleX: c.scaleX * 0.6, scaleY: c.scaleY * 0.6,
      duration: dur(700), ease: 'Cubic.easeInOut',
      onComplete: () => {
        sparkle(this, COOLER.x, COOLER.y - 20);
        this.tweens.add({
          targets: c, alpha: 0, duration: dur(200), onComplete: () => { c.destroy(); this.nextFish(); },
        });
      },
    });
  }

  // Cooler full: the fish flips into the water bucket with a splash. No penalty.
  flyToBucket(it) {
    const c = it.c;
    c.setDepth(D.flying);
    this.tweens.add({
      targets: c, x: BUCKET.x, y: BUCKET.y - 10, angle: 360, scaleX: c.scaleX * 0.6, scaleY: c.scaleY * 0.6,
      duration: dur(800), ease: 'Cubic.easeInOut',
      onComplete: () => {
        splash(this, BUCKET.x, BUCKET.y - 30, 0xffffff);
        const ring = this.add.image(BUCKET.x, BUCKET.y, 'splash-ring').setDepth(D.flying + 1).setScale(0.4).setAlpha(0.9);
        this.tweens.add({ targets: ring, scale: 1.1, alpha: 0, duration: dur(600), onComplete: () => ring.destroy() });
        this.tweens.add({
          targets: c, alpha: 0, duration: dur(300), onComplete: () => { c.destroy(); this.nextFish(); },
        });
      },
    });
  }

  nextFish() {
    this.resetDots();
    this.next += 1;
    if (this.next >= this.items.length) {
      this.finish();
      return;
    }
    this.phase = 'idle';
    this.activate();
  }

  // ---- recap ----

  finish() {
    this.phase = 'done';
    const round = this.round;
    const n = prepCoins(round.results);
    // Coins are given once per round, even if this scene is entered again.
    if (!round.prepCoinsGiven) {
      round.prepCoinsGiven = true;
      if (n > 0) updateState((s) => ({ ...s, coins: s.coins + n }));
    }
    this.add.image(COUNTER.x, COUNTER.y, 'coin').setDisplaySize(80, 80).setDepth(D.ok);
    this.coinText = this.add.text(COUNTER.x - 60, COUNTER.y, String(Math.max(0, getState().coins - n)), {
      fontFamily: 'sans-serif', fontSize: '44px', color: '#ffffff', fontStyle: 'bold', stroke: '#1f2a44', strokeThickness: 6,
    }).setOrigin(1, 0.5).setDepth(D.ok);
    this.flyCoins(n, 0);
  }

  flyCoins(n, i) {
    if (i >= n) {
      this.showOk();
      return;
    }
    const coin = this.add.image(W / 2 + (i - (n - 1) / 2) * 140, H / 2, 'coin').setDisplaySize(120, 120).setDepth(D.flying);
    popIn(this, coin);
    this.time.delayedCall(dur(600), () => {
      this.tweens.add({
        targets: coin, x: COUNTER.x, y: COUNTER.y, scale: 0.5, duration: dur(700), ease: 'Cubic.easeIn',
        onComplete: () => {
          coin.destroy();
          sparkle(this, COUNTER.x, COUNTER.y);
          this.coinText.setText(String(Number(this.coinText.text) + 1));
          this.flyCoins(n, i + 1);
        },
      });
    });
  }

  showOk() {
    const ok = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => goTo(this, 'Kitchen'))
      .setDepth(D.ok);
    popIn(this, ok);
  }

  // Fades out, then opens the collection home (the game is two levels below it).
  goHome() {
    if (this.__leaving) return;
    this.__leaving = {};
    this.cameras.main.once('camerafadeoutcomplete', () => { window.location.href = HOME_URL; });
    this.cameras.main.fadeOut(250);
  }
}
