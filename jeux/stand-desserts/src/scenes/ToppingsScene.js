// Toppings (theme `logique`). The level comes with the order (order.toppingMode):
// - N1 'counts': drag owned toppings one by one onto the top-down cake. A copy dropped on the cake
//   (a shape-mask cell) stays put; dropped anywhere else it goes back to the shelf. Every owned
//   kind is on the shelf; the order can ask for several kinds, each with its own count.
// - N2 'motif': a ring of 6 or 8 slots fitted to the shape (logic/ring.js); the start of the motif
//   is already there (slots on a white plate with a golden edge, at full colour: they are part of
//   the cake, not hints). She continues the pattern: a topping dropped near an empty slot snaps
//   into the nearest one, anywhere else it goes back. A topping she put can be dragged to another
//   empty slot, or off the cake to take it away. Judged slot by slot.
// - N3 'hints': free placement as N1, the cake moved left; the hint card on the right (pictures
//   and signs only: « 🍓🍓🍓 », « ⭐ = 🍓 », « 🕯 = 🍓 + 1 », « − 1 »), visible all along. Exact counts.
// At N2-N3 the order strip does not tell the toppings.
import { W, H } from '../config.js';
import { getRound, getState } from '../game-state.js';
import { ownedKeys } from '../logic/catalog.js';
import { GRID } from '../logic/paint.js';
import { judgeToppings, judgeMotif, judgeOrderToppings } from '../logic/scoring.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { drawCake, shapeMask, shapeRing, FRAME, TOPPING_SIZE } from '../ui/cakeView.js';
import { goNext, restart } from '../ui/flow.js';
import { popIn, sparkle } from '../ui/fx.js';

const CAKE_Y = 375;
const CAKE_SIZE = 480;
const SCALE = CAKE_SIZE / FRAME;
const SHELF_Y = 728;
const STEP = 140;
const ICON = 112;
const DRAG_SIZE = TOPPING_SIZE * SCALE * 1.15;
const MAX_TOPPINGS = 12; // soft cap: past it the cake becomes an unreadable pile ('trop' still judged)
// N2 ring
const SLOT_ART = 96; // slot-ring texture size
const IN_SLOT = 80 / 96; // a topping in a slot, relative to the slot (the dashes stay visible around it)
const SNAP = 84; // screen px: a drop this near a free slot's centre goes into the nearest one
const PREFILL_EDGE = 0xf4b400;
// N3 hint card (hint-card art: 400 x 460, face from y 40, content rows at y 162, 269, 376)
const HINTS_CAKE_X = 520;
const CARD_X = 1020;
const CARD_Y = 360;
const CARD_SCALE = 0.92;
const ROW_Y0 = 162;
const ROW_PITCH = 107;
const CARD_TOP = 110; // the card stretches between its 110 px top and 60 px bottom
const CARD_BOTTOM = 60;
const CARD_TOPPING = 74;
const SIGN_SCALE = 0.62;

export class ToppingsScene extends Phaser.Scene {
  constructor() {
    super('Toppings');
  }

  create() {
    const round = getRound();
    this.round = round;
    if (window.__game) window.__round = round;
    const order = round.order;
    this.level = round.levels?.toppings ?? 1;
    this.mode = order.toppingMode === 'motif' && order.motif ? 'motif'
      : order.toppingMode === 'hints' && order.hintCard ? 'hints' : 'counts';
    this.cakeX = this.mode === 'hints' ? HINTS_CAKE_X : W / 2;
    this.shape = round.cake.shape ?? order.shape;
    this.mask = shapeMask(this, this.shape);
    this.placed = []; // [{key, x, y}] in frame units, relative to the cake centre (free placement)
    this.slots = null; // N2: [{x, y (screen), fx, fy (frame), want, key, prefilled, marker, img}]
    this.drag = null;
    this.pulse = null;
    this.hintCard = null;
    this.sparkled = false; // true while the toppings match the order exactly
    this.shelfX = {};

    this.cameras.main.setBackgroundColor(0xe8f5e9);
    addOrderReminder(this, order, 'toppings', round.levels?.commande, { hideToppings: this.mode !== 'counts' });
    this.cake = drawCake(this, this.cakeX, CAKE_Y, { ...round.cake, shape: this.shape, toppings: [] },
      { size: CAKE_SIZE, view: 'top' });
    this.drawShelf();
    if (this.mode === 'motif') this.drawRing();
    if (this.mode === 'hints') this.drawHintCard();

    this.input.on('pointerdown', (p, over) => this.onDown(p, over));
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
      this.shelfX[key] = x;
      const img = this.add.image(x, SHELF_Y, `topping-${key}`).setDepth(5);
      img.setScale(ICON / Math.max(img.width, img.height));
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', p => this.startDrag(p, key, x));
    });
  }

  // A topping image inside the cake's top face (frame units): under the shape line (free
  // placement, as drawCake does), or over it (N2: the ring and its toppings are drawn over the line,
  // which may cross a slot near the edge).
  addOnTop(key, x, y, size) {
    const top = this.cake.top;
    const t = this.add.image(x, y, `topping-${key}`);
    t.setScale(size / Math.max(t.width, t.height));
    if (this.mode === 'motif') top.add(t);
    else top.addAt(t, top.length - 1);
    return t;
  }

  // ---- N2: the ring -------------------------------------------------------------------------------
  drawRing() {
    const { motif } = this.round.order;
    const ring = shapeRing(this, this.shape, motif.slots);
    this.slotSize = ring.size; // frame units
    const top = this.cake.top;
    const r = (ring.size * 40) / SLOT_ART; // the art's dashed circle radius
    this.slots = ring.slots.map((p, i) => {
      const prefilled = i < motif.prefill;
      const s = {
        fx: p.x, fy: p.y, x: this.cakeX + p.x * SCALE, y: CAKE_Y + p.y * SCALE,
        want: motif.sequence[i], key: null, prefilled, marker: null, img: null,
      };
      if (prefilled) {
        // part of the cake already: a white plate with a golden edge, the topping in full colour
        const plate = this.add.graphics();
        plate.fillStyle(0xffffff, 0.92).fillCircle(p.x, p.y, r + 2);
        plate.lineStyle(6, PREFILL_EDGE, 1).strokeCircle(p.x, p.y, r + 2);
        top.add(plate);
        s.marker = plate;
        s.key = s.want;
        s.img = this.addOnTop(s.want, p.x, p.y, ring.size * IN_SLOT);
      } else {
        const m = this.add.image(p.x, p.y, 'slot-ring');
        m.setScale(ring.size / Math.max(m.width, m.height));
        m.baseScale = m.scaleX;
        top.add(m);
        s.marker = m;
      }
      return s;
    });
    this.pulseNext();
  }

  // The first empty slot (in the motif's order) breathes: where the pattern goes on.
  pulseNext() {
    if (this.pulse) {
      this.pulse.stop();
      this.pulse.targets.forEach(m => m.setScale(m.baseScale));
      this.pulse = null;
    }
    const next = this.slots.find(s => !s.key);
    if (!next) return;
    const m = next.marker;
    this.pulse = this.tweens.add({
      targets: m, scale: { from: m.baseScale, to: m.baseScale * 1.14 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  nearestSlot(px, py, filter) {
    let best = null;
    let bd = SNAP;
    for (const s of this.slots) {
      if (!filter(s)) continue;
      const d = Math.hypot(px - s.x, py - s.y);
      if (d <= bd) { best = s; bd = d; }
    }
    return best;
  }

  fillSlot(s, key) {
    s.key = key;
    s.img = this.addOnTop(key, s.fx, s.fy, this.slotSize * IN_SLOT);
    popIn(this, s.img);
    this.pulseNext();
    this.afterChange();
  }

  emptySlot(s) {
    s.img?.destroy();
    s.img = null;
    s.key = null;
    this.pulseNext();
    this.afterChange();
  }

  // ---- N3: the hint card --------------------------------------------------------------------------
  drawHintCard() {
    const { hints } = this.round.order.hintCard;
    const rows = Math.min(3, hints.length);
    const h = 460 - (3 - rows) * ROW_PITCH;
    const card = this.add.container(CARD_X, CARD_Y).setDepth(10).setScale(CARD_SCALE);
    const bg = this.add.nineslice(0, 0, 'hint-card', undefined, 400, h, 0, 0, CARD_TOP, CARD_BOTTOM);
    card.add(bg);
    // card-frame coordinates (400 x h, origin top-left) -> container coordinates
    const cx = x => x - 200;
    const cy = y => y - h / 2;
    const topping = (key, x, y) => {
      const t = this.add.image(cx(x), cy(y), `topping-${key}`);
      t.setScale(CARD_TOPPING / Math.max(t.width, t.height));
      return t;
    };
    const sign = (key, x, y) => this.add.image(cx(x), cy(y), key).setScale(SIGN_SCALE);
    hints.slice(0, rows).forEach((hint, r) => {
      const y = ROW_Y0 + r * ROW_PITCH;
      if (hint.rel === 'count') {
        // the pictures themselves: « 🍓🍓🍓 » (up to 4, then tighter)
        const pitch = hint.count <= 4 ? 78 : 62;
        const x0 = 200 - ((hint.count - 1) * pitch) / 2;
        for (let i = 0; i < hint.count; i++) card.add(topping(hint.key, x0 + i * pitch, y));
        return;
      }
      // « B = A », « B = A + 1 », « B = A − 1 »
      const extra = hint.rel === 'plus' ? 'sym-plus1' : hint.rel === 'minus' ? 'sym-minus1' : null;
      const xs = extra ? [80, 164, 248, 334] : [122, 206, 290];
      card.add(topping(hint.key, xs[0], y));
      card.add(sign('sym-equal', xs[1], y));
      card.add(topping(hint.of, xs[2], y));
      if (extra) card.add(sign(extra, xs[3], y));
    });
    this.hintCard = card;
  }

  // ---- dragging -----------------------------------------------------------------------------------
  startDrag(p, key, homeX, from = null) {
    if (this.drag) return;
    if (this.mode !== 'motif' && this.placed.length >= MAX_TOPPINGS) return;
    const img = this.add.image(p.x, p.y, `topping-${key}`).setDepth(40);
    img.setScale(DRAG_SIZE / Math.max(img.width, img.height));
    this.drag = { key, img, homeX, id: p.id, from };
  }

  // N2: a press near a topping she put picks it up again (the prefilled ones stay).
  onDown(p, over) {
    if (this.mode !== 'motif' || this.drag || over?.length) return;
    const s = this.nearestSlot(p.x, p.y, q => q.key && !q.prefilled);
    if (!s) return;
    const { key } = s;
    this.emptySlot(s);
    this.startDrag(p, key, this.shelfX[key] ?? W / 2, s);
  }

  onMove(p) {
    if (this.drag && p.id === this.drag.id) this.drag.img.setPosition(p.x, p.y);
  }

  // Frame coordinates of a screen point, or null when it is not on the cake silhouette.
  onCake(px, py) {
    const x = (px - this.cakeX) / SCALE;
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
    if (this.mode === 'motif') {
      const s = this.nearestSlot(p.x, p.y, q => !q.key);
      if (s) {
        img.destroy();
        this.fillSlot(s, key);
        return;
      }
    } else {
      const at = this.onCake(p.x, p.y);
      if (at) {
        img.destroy();
        this.place(key, at.x, at.y);
        return;
      }
    }
    this.tweens.add({
      targets: img, x: homeX, y: SHELF_Y, duration: 240, ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  // Free placement: adds the topping to the cake's top face, under the shape line (as drawCake does).
  place(key, x, y) {
    this.placed.push({ key, x, y });
    popIn(this, this.addOnTop(key, x, y, TOPPING_SIZE));
    this.afterChange();
  }

  // What she has put (slot keys, prefilled included, in N2; the placed keys otherwise).
  answer() {
    return this.mode === 'motif' ? this.slots.map(s => s.key) : this.placed.map(p => p.key);
  }

  // ✓ is on once she has put something. Visual feedback only (scoring happens at ✓): one sparkle
  // when the toppings match the order exactly (N2: every slot right); it can come again only
  // after the match is lost and regained.
  afterChange() {
    const mine = this.mode === 'motif' ? this.slots.filter(s => s.key && !s.prefilled).length : this.placed.length;
    this.bar.setValidateEnabled(mine > 0);
    const exact = this.mode === 'motif'
      ? judgeMotif(this.answer(), this.round.order.motif.sequence).ok
      : judgeToppings(this.answer(), this.round.order.toppings).ok;
    if (exact && !this.sparkled) sparkle(this, this.cakeX, CAKE_Y);
    this.sparkled = exact;
  }

  validate() {
    this.round.results.toppings = judgeOrderToppings(this.answer(), this.round.order);
    this.round.cake.toppings = this.mode === 'motif'
      ? this.slots.filter(s => s.key).map(s => ({ key: s.key, x: s.fx, y: s.fy }))
      : this.placed.map(p => ({ ...p }));
    if (this.mode === 'motif') this.round.toppingSlots = this.answer();
    goNext(this);
  }
}
