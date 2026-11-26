// Plating at level 1: one portion per plate. The plates of the order stand on the counter (two
// rows above 6), the portions from the cutting wait in a tray. She drags each portion onto a
// plate: it snaps to the nearest plate within reach, else goes back to the tray. A portion on a
// plate can be moved again until ✓, which shows once the tray is empty. A wrong plating is shown
// put right (one portion per plate), then the client eats, the face shows the order's points and
// the coins fly to the counter (saved once).
import { W, H, TOUCH, BG, COLOR_HEX } from '../config.js';
import { addIconButton } from '../ui/button.js';
import { goTo, nextAfterPlate, restart } from '../ui/flow.js';
import { dur } from '../ui/pace.js';
import { blink, crumbs, popIn, sparkle, talk } from '../ui/fx.js';
import { drawClient } from '../ui/client.js';
import { getRound, getState, updateState } from '../game-state.js';
import { mood, orderCoins } from '../logic/scoring.js';

const HOME_URL = '../../index.html';

const CLIENT = { x: 170, y: 300 };
const PLATES = { cx: 720, span: 760, oneRow: { y: 530, size: 150, gap: 165 }, twoRows: { y: [470, 600], size: 125, gap: 140 } };
const MAX_ONE_ROW = 6;
const TRAY = { left: 360, top: 662, w: 720, h: 120, y: 722, cx: 720, span: 620, gap: 130 };
const PORTION_SCALE = 0.7;
const PORTION_HIT = 160; // local px (x PORTION_SCALE = 112 px on screen)
const REACH = 0.75; // x plate size: how far from a plate a portion still snaps onto it
const STACK = { dx: 30, dy: -6 }; // extra portions on one plate
const COUNTER = { x: W - 110, y: 70 };
const RESTART = { x: W - 24 - TOUCH / 2, y: H - 24 - TOUCH / 2 - TOUCH - 24 };
const D = { client: 10, counter: 20, tray: 30, plate: 40, portion: 100, drag: 200, flying: 300, ok: 400, home: 500 };

// x of item i of n centred on cx, at most `gap` apart and within `span`.
function rowX(i, n, cx, span, gap) {
  const step = n > 1 ? Math.min(gap, span / (n - 1)) : 0;
  return cx + (i - (n - 1) / 2) * step;
}

export class PlateScene extends Phaser.Scene {
  constructor() {
    super('Plate');
  }

  create() {
    // Phaser reuses the instance: every per-run field is reset here.
    this.round = getRound();
    const round = this.round;
    this.result = round.results.orders[round.orderIndex]
      ?? (round.results.orders[round.orderIndex] = { cuisine: true, decoupe: true, dressage: true });
    this.plates = [];
    this.portions = [];
    this.phase = 'idle'; // idle | busy | done
    this.okButton = null;
    this.coinText = null;
    this.__leaving = null;

    this.cameras.main.setBackgroundColor(BG);
    this.add.image(W / 2, H / 2, 'kitchen-bg').setDepth(0);
    if (round.client) {
      this.client = drawClient(this, CLIENT.x, CLIENT.y, round.client, 'content').setDepth(D.client);
      blink(this, this.client);
    } else {
      this.client = null;
    }
    this.add.image(W / 2, 540, 'counter').setDepth(D.counter);
    this.add.graphics().setDepth(D.tray)
      .fillStyle(0xb0bec5, 1).fillRoundedRect(TRAY.left, TRAY.top, TRAY.w, TRAY.h, 24)
      .lineStyle(6, 0x607d8b, 1).strokeRoundedRect(TRAY.left, TRAY.top, TRAY.w, TRAY.h, 24);

    this.buildPlates(round.order?.plates ?? 0);
    this.buildPortions(round.chosen ?? []);
    this.buildCoins();

    addIconButton(this, 24 + TOUCH / 2, 24 + TOUCH / 2, 'icon-home', () => this.goHome()).setDepth(D.home);
    this.restartButton = addIconButton(this, RESTART.x, RESTART.y, 'icon-restart', () => restart(this)).setDepth(D.ok);

    this.input.on('dragstart', (pointer, obj) => this.onDragStart(obj));
    this.input.on('drag', (pointer, obj, x, y) => { if (this.phase === 'idle') obj.setPosition(x, y); });
    this.input.on('dragend', (pointer, obj) => this.onDrop(obj));
    this.updateOk();
  }

  // ---- layout ----

  buildPlates(n) {
    const two = n > MAX_ONE_ROW;
    const conf = two ? PLATES.twoRows : PLATES.oneRow;
    const perRow = two ? Math.ceil(n / 2) : n;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow);
      const inRow = row === 0 ? perRow : n - perRow;
      const x = rowX(i % perRow, inRow, PLATES.cx, PLATES.span, conf.gap);
      const y = two ? conf.y[row] : conf.y;
      const img = this.add.image(x, y, 'plate').setDisplaySize(conf.size, conf.size).setDepth(D.plate);
      this.plates.push({ x, y, size: conf.size, img, items: [] });
    }
  }

  // Every chosen fish gives as many portions as its weight, in its colour.
  buildPortions(fish) {
    const colors = fish.flatMap((f) => Array.from({ length: f.weight }, () => f.color));
    colors.forEach((color, i) => {
      const x = rowX(i, colors.length, TRAY.cx, TRAY.span, TRAY.gap);
      const img = this.add.image(0, 0, 'portion').setTint(COLOR_HEX[color] ?? 0xffffff);
      const c = this.add.container(x, TRAY.y, [img]).setScale(PORTION_SCALE).setDepth(D.portion);
      c.setSize(PORTION_HIT, PORTION_HIT);
      c.setInteractive({ useHandCursor: true, draggable: true });
      this.input.setDraggable(c);
      const it = { c, color, home: { x, y: TRAY.y }, plate: null };
      c.portion = it;
      this.portions.push(it);
    });
  }

  buildCoins() {
    this.add.image(COUNTER.x, COUNTER.y, 'coin').setDisplaySize(80, 80).setDepth(D.ok);
    this.coinText = this.add.text(COUNTER.x - 60, COUNTER.y, String(getState().coins), {
      fontFamily: 'sans-serif', fontSize: '44px', color: '#ffffff', fontStyle: 'bold', stroke: '#1f2a44', strokeThickness: 6,
    }).setOrigin(1, 0.5).setDepth(D.ok);
  }

  // Portions on a plate: centred, a little apart when there are several.
  layoutPlate(plate) {
    const m = plate.items.length;
    plate.items.forEach((it, k) => {
      this.tweens.add({
        targets: it.c, x: plate.x + (k - (m - 1) / 2) * STACK.dx, y: plate.y + k * STACK.dy,
        duration: dur(200), ease: 'Quad.easeOut',
      });
      it.c.setDepth(D.portion + k);
    });
  }

  // ---- dragging ----

  onDragStart(obj) {
    const it = obj.portion;
    if (!it || this.phase !== 'idle') return;
    this.tweens.killTweensOf(obj);
    if (it.plate) {
      const plate = it.plate;
      plate.items = plate.items.filter((x) => x !== it);
      it.plate = null;
      this.layoutPlate(plate);
    }
    obj.setDepth(D.drag);
    this.updateOk();
  }

  onDrop(obj) {
    const it = obj.portion;
    if (!it || this.phase !== 'idle') return;
    let best = null;
    let bestDist = Infinity;
    for (const p of this.plates) {
      const d = Phaser.Math.Distance.Between(obj.x, obj.y, p.x, p.y);
      if (d <= p.size * REACH && d < bestDist) { best = p; bestDist = d; }
    }
    if (best) {
      it.plate = best;
      best.items.push(it);
      this.layoutPlate(best);
    } else {
      obj.setDepth(D.portion);
      this.tweens.add({ targets: obj, x: it.home.x, y: it.home.y, duration: dur(300), ease: 'Back.easeOut' });
    }
    this.updateOk();
  }

  // ✓ shows once the tray is empty.
  updateOk() {
    const show = this.phase === 'idle' && this.portions.length > 0 && this.portions.every((p) => p.plate);
    if (show && !this.okButton) {
      this.okButton = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => this.onOk()).setDepth(D.ok);
      popIn(this, this.okButton);
    } else if (!show && this.okButton) {
      this.okButton.destroy();
      this.okButton = null;
    }
  }

  // ---- serving ----

  onOk() {
    if (this.phase !== 'idle') return;
    this.phase = 'busy';
    this.okButton?.disableInteractive().setVisible(false);
    this.restartButton.disableInteractive().setVisible(false); // nothing to start again once served
    for (const p of this.portions) p.c.disableInteractive();
    this.result.dressage = this.plates.every((p) => p.items.length === 1);
    if (this.result.dressage) {
      sparkle(this, PLATES.cx, this.plates[0]?.y ?? H / 2);
      this.time.delayedCall(dur(600), () => this.eat());
    } else {
      this.time.delayedCall(dur(500), () => this.showRight());
    }
  }

  // What was needed: one portion on each plate.
  showRight() {
    const all = this.portions;
    for (const p of this.plates) p.items = [];
    all.forEach((it, i) => {
      const plate = this.plates[i % this.plates.length];
      it.plate = plate;
      plate.items.push(it);
    });
    this.plates.forEach((p) => this.layoutPlate(p));
    this.time.delayedCall(dur(1500), () => this.eat());
  }

  // The client eats the plates one by one.
  eat() {
    const plates = this.plates.filter((p) => p.items.length > 0);
    if (this.client) talk(this, this.client, dur(400) * plates.length + 200);
    const next = (i) => {
      if (i >= plates.length) {
        this.time.delayedCall(dur(300), () => this.pay());
        return;
      }
      const p = plates[i];
      crumbs(this, p.x, p.y, p.items.map((it) => COLOR_HEX[it.color] ?? 0xffffff), 4);
      this.tweens.add({
        targets: p.items.map((it) => it.c), scale: 0, alpha: 0, duration: dur(300), ease: 'Quad.easeIn',
        onComplete: () => this.time.delayedCall(dur(100), () => next(i + 1)),
      });
    };
    next(0);
  }

  pay() {
    const round = this.round;
    const result = this.result;
    const n = orderCoins(result);
    if (this.client) {
      this.client.setMood(mood(n));
      talk(this, this.client, 600);
    }
    // Coins are given once per order, and the order counts once, even if this scene runs again.
    if (!result.paid) {
      result.paid = true;
      if (n > 0) updateState((s) => ({ ...s, coins: s.coins + n }));
      round.orderIndex += 1;
    }
    this.flyCoins(n, 0);
  }

  flyCoins(n, i) {
    if (i >= n) {
      this.showNext();
      return;
    }
    const from = this.client ? { x: this.client.x + 140, y: this.client.y - 40 } : { x: W / 2, y: H / 2 };
    const coin = this.add.image(from.x + i * 40, from.y, 'coin').setDisplaySize(110, 110).setDepth(D.flying);
    popIn(this, coin);
    this.time.delayedCall(dur(500), () => {
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

  showNext() {
    this.phase = 'done';
    this.okButton?.destroy();
    this.okButton = null;
    const next = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-next',
      () => goTo(this, nextAfterPlate(this.round))).setDepth(D.ok);
    popIn(this, next);
  }

  // Fades out, then opens the collection home (the game is two levels below it).
  goHome() {
    if (this.__leaving) return;
    this.__leaving = {};
    this.cameras.main.once('camerafadeoutcomplete', () => { window.location.href = HOME_URL; });
    this.cameras.main.fadeOut(250);
  }
}
