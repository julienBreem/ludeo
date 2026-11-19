// Toppings: drag owned toppings one by one onto the top-down cake. A copy dropped on the cake
// (a shape-mask cell) stays put; dropped anywhere else it goes back to the shelf.
import { W, H } from '../config.js';
import { getRound, getState } from '../game-state.js';
import { ownedKeys } from '../logic/catalog.js';
import { GRID } from '../logic/paint.js';
import { judgeToppings } from '../logic/scoring.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { drawCake, shapeMask, FRAME, TOPPING_SIZE } from '../ui/cakeView.js';
import { goNext, restart } from '../ui/flow.js';
import { popIn, sparkle } from '../ui/fx.js';

const CAKE_X = W / 2;
const CAKE_Y = 375;
const CAKE_SIZE = 480;
const SCALE = CAKE_SIZE / FRAME;
const SHELF_Y = 728;
const STEP = 140;
const ICON = 112;
const DRAG_SIZE = TOPPING_SIZE * SCALE * 1.15;
const MAX_TOPPINGS = 12; // soft cap: past it the cake becomes an unreadable pile ('trop' still judged)

export class ToppingsScene extends Phaser.Scene {
  constructor() {
    super('Toppings');
  }

  create() {
    const round = getRound();
    this.round = round;
    if (window.__game) window.__round = round;
    this.shape = round.cake.shape ?? round.order.shape;
    this.mask = shapeMask(this, this.shape);
    this.placed = []; // [{key, x, y}] in frame units, relative to the cake centre
    this.drag = null;
    this.sparkled = false;

    this.cameras.main.setBackgroundColor(0xe8f5e9);
    addOrderReminder(this, round.order);
    this.cake = drawCake(this, CAKE_X, CAKE_Y, { ...round.cake, shape: this.shape, toppings: [] },
      { size: CAKE_SIZE, view: 'top' });
    this.drawShelf();

    this.input.on('pointermove', p => this.onMove(p));
    this.input.on('pointerup', p => this.onUp(p));
    this.input.on('pointerupoutside', p => this.onUp(p));

    this.bar = addStepBar(this, { onRestart: () => restart(this), onValidate: () => this.validate() });
  }

  drawShelf() {
    this.add.rectangle(W / 2, H - 70, W, 140, 0xc98a4b).setDepth(1);
    this.add.rectangle(W / 2, H - 140, W, 10, 0xe0a766).setDepth(1);
    const keys = ownedKeys(getState().owned, 'topping');
    const x0 = W / 2 - ((keys.length - 1) * STEP) / 2;
    keys.forEach((key, i) => {
      const x = x0 + i * STEP;
      const img = this.add.image(x, SHELF_Y, `topping-${key}`).setDepth(5);
      img.setScale(ICON / Math.max(img.width, img.height));
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', p => this.startDrag(p, key, x));
    });
  }

  startDrag(p, key, homeX) {
    if (this.drag || this.placed.length >= MAX_TOPPINGS) return;
    const img = this.add.image(p.x, p.y, `topping-${key}`).setDepth(40);
    img.setScale(DRAG_SIZE / Math.max(img.width, img.height));
    this.drag = { key, img, homeX, id: p.id };
  }

  onMove(p) {
    if (this.drag && p.id === this.drag.id) this.drag.img.setPosition(p.x, p.y);
  }

  // Frame coordinates of a screen point, or null when it is not on the cake silhouette.
  onCake(px, py) {
    const x = (px - CAKE_X) / SCALE;
    const y = (py - CAKE_Y) / SCALE;
    const u = Math.floor(((x + FRAME / 2) * GRID) / FRAME);
    const v = Math.floor(((y + FRAME / 2) * GRID) / FRAME);
    if (u < 0 || v < 0 || u >= GRID || v >= GRID || !this.mask[v * GRID + u]) return null;
    return { x: Math.round(x), y: Math.round(y) };
  }

  onUp(p) {
    if (!this.drag || p.id !== this.drag.id) return;
    const { key, img, homeX } = this.drag;
    this.drag = null;
    const at = this.onCake(p.x, p.y);
    if (at) {
      img.destroy();
      this.place(key, at.x, at.y);
    } else {
      this.tweens.add({
        targets: img, x: homeX, y: SHELF_Y, duration: 240, ease: 'Quad.easeOut',
        onComplete: () => img.destroy(),
      });
    }
  }

  // Adds the topping to the cake's top face, under the shape line (as drawCake does).
  place(key, x, y) {
    this.placed.push({ key, x, y });
    const top = this.cake.top;
    const t = this.add.image(x, y, `topping-${key}`);
    t.setScale(TOPPING_SIZE / Math.max(t.width, t.height));
    top.addAt(t, top.length - 1);
    popIn(this, t);
    if (this.placed.length === 1) this.bar.setValidateEnabled(true);

    // Visual feedback only (scoring happens at ✓): one sparkle on the exact count and kind.
    const { topping, toppingCount } = this.round.order;
    if (!this.sparkled && this.placed.length === toppingCount && this.placed.every(p => p.key === topping)) {
      this.sparkled = true;
      sparkle(this, CAKE_X, CAKE_Y);
    }
  }

  validate() {
    this.round.results.toppings = judgeToppings(this.placed.map(p => p.key), this.round.order);
    this.round.cake.toppings = this.placed.map(p => ({ ...p }));
    goNext(this);
  }
}
