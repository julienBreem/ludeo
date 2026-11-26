// Kitchen at level 1. A client walks in and shows the order in a bubble: a fish of the order's
// colour and a plate with a dice (how many plates). The open cooler shows every fish with its label.
// Tapping a fish moves it to the board, tapping it on the board puts it back. No total is shown.
// ✓ checks the board: a wrong choice clears it and the right combination slides on with a glow
// (what was needed), then the game goes on with it. The fish used leave the cooler at that moment.
import { W, H, TOUCH, BG } from '../config.js';
import { addIconButton } from '../ui/button.js';
import { goTo } from '../ui/flow.js';
import { dur } from '../ui/pace.js';
import { blink, popIn, sparkle, talk } from '../ui/fx.js';
import { drawFish } from '../ui/fishArt.js';
import { drawClient } from '../ui/client.js';
import { coolerLayout, drawCoolerFish, drawCoolerPanel } from '../ui/cooler.js';
import { generateClient } from '../../../../shared/client.js';
import { getRound, getState, updateState } from '../game-state.js';
import { gameSetup } from '../logic/setup.js';
import { drawOrder, isExactCombination, suggestCombination } from '../logic/orders.js';
import { removeFish, usable } from '../logic/stock.js';

const HOME_URL = '../../index.html';

const CLIENT = { x: 190, y: 300, fromX: -220 };
const BUBBLE = { x: 470, y: 175, scale: 1.3 };
const BUBBLE_FISH = { x: 392, y: 150, size: 0.55 };
const BUBBLE_PLATE = { x: 552, y: 150, size: 120, dice: 72 };
const BOARD = { x: 950, y: 255, scale: 1.45 };
const SLOT = { gapX: 150, oneRowY: 240, firstRowY: 185, gapY: 125, perRow: 3, max: 6 };
const BOARD_ZOOM = 1.2; // board fish are drawn a little bigger than in the cooler
const COOLER = { left: 40, top: 474, w: 1040, h: 306 };
const RESTART = { x: W - 24 - TOUCH / 2, y: 540 };
const D = { client: 10, counter: 20, cooler: 25, bubble: 30, board: 40, glow: 45, fish: 100, moving: 300, ok: 400, home: 500 };

export class KitchenScene extends Phaser.Scene {
  constructor() {
    super('Kitchen');
  }

  create() {
    // Phaser reuses the instance: every per-run field is reset here.
    this.round = getRound();
    this.level = this.round.levels.cuisine;
    this.colors = gameSetup(getState()).colors;
    this.items = [];
    this.board = [];
    this.glows = [];
    this.phase = 'intro'; // intro | idle | busy
    this.okButton = null;
    this.__leaving = null;

    this.cameras.main.setBackgroundColor(BG);
    this.add.image(W / 2, H / 2, 'kitchen-bg').setDepth(0);
    addIconButton(this, 24 + TOUCH / 2, 24 + TOUCH / 2, 'icon-home', () => this.goHome()).setDepth(D.home);

    const round = this.round;
    const previous = round.order;
    round.order = drawOrder(getState().stock, this.level, this.colors, Math.random, previous);
    if (!round.order) {
      // Nothing can be cooked from the cooler: straight to the end of the round.
      goTo(this, 'End');
      return;
    }
    // A new client for every order, never drawn the same as the previous one.
    round.client = generateClient(Math.random, round.client ?? null);

    this.add.image(BOARD.x, BOARD.y, 'board').setScale(BOARD.scale).setDepth(D.board);
    this.add.image(W / 2, 540, 'counter').setDepth(D.counter);
    drawCoolerPanel(this, COOLER, D.cooler);
    this.buildCooler();
    this.buildBubble(round.order);

    this.okButton = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => this.onOk())
      .setDepth(D.ok);
    addIconButton(this, RESTART.x, RESTART.y, 'icon-restart', () => this.clearBoard()).setDepth(D.ok);
    this.updateOk();

    this.client = drawClient(this, CLIENT.fromX, CLIENT.y, round.client, 'content').setDepth(D.client);
    blink(this, this.client);
    this.tweens.add({
      targets: this.client, x: CLIENT.x, duration: dur(800), ease: 'Sine.easeOut',
      onComplete: () => {
        this.bubble.setVisible(true);
        popIn(this, this.bubble);
        talk(this, this.client, 1500);
        this.phase = 'idle';
      },
    });
  }

  // ---- layout ----

  buildBubble(order) {
    const bubble = this.add.container(BUBBLE.x, BUBBLE.y).setDepth(D.bubble).setVisible(false);
    bubble.add(this.add.image(0, 0, 'bubble').setScale(BUBBLE.scale));
    const fish = drawFish(this, BUBBLE_FISH.x - BUBBLE.x, BUBBLE_FISH.y - BUBBLE.y, { color: order.color, size: 'moyen' },
      { size: BUBBLE_FISH.size });
    bubble.add(fish);
    const px = BUBBLE_PLATE.x - BUBBLE.x;
    const py = BUBBLE_PLATE.y - BUBBLE.y;
    bubble.add(this.add.image(px, py, 'plate').setDisplaySize(BUBBLE_PLATE.size, BUBBLE_PLATE.size));
    // N1: plates <= 5, shown as a dice
    bubble.add(this.add.image(px, py, `dice-${order.plates}`).setDisplaySize(BUBBLE_PLATE.dice, BUBBLE_PLATE.dice));
    this.bubble = bubble;
  }

  buildCooler() {
    const stock = getState().stock;
    const ok = new Set(usable(stock, this.level).map((f) => f.id));
    for (const { fish, x, y } of coolerLayout(stock, this.colors, COOLER)) {
      const c = drawCoolerFish(this, fish, x, y, this.level).setDepth(D.fish);
      const it = { fish, c, home: { x, y }, base: c.scaleX, onBoard: false };
      if (ok.has(fish.id)) {
        c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => this.onFishTap(it));
      } else {
        c.setAlpha(0.45); // too heavy for this level: it stays in the cooler (she can release it at the end)
      }
      this.items.push(it);
    }
  }

  // Board slot i of n: one row up to 3 fish, else two rows.
  slot(i, n) {
    const rows = n > SLOT.perRow ? 2 : 1;
    const row = Math.floor(i / SLOT.perRow);
    const inRow = rows === 1 ? n : (row === 0 ? SLOT.perRow : n - SLOT.perRow);
    const col = i % SLOT.perRow;
    return {
      x: BOARD.x + (col - (inRow - 1) / 2) * SLOT.gapX,
      y: rows === 1 ? SLOT.oneRowY : SLOT.firstRowY + row * SLOT.gapY,
    };
  }

  // ---- choosing ----

  onFishTap(it) {
    if (this.phase !== 'idle') return;
    if (it.onBoard) {
      this.board = this.board.filter((b) => b !== it);
      it.onBoard = false;
      this.moveHome(it);
    } else {
      if (this.board.length >= SLOT.max) {
        this.tweens.add({ targets: it.c, angle: { from: -8, to: 8 }, duration: dur(80), yoyo: true, repeat: 2, onComplete: () => it.c.setAngle(0) });
        return;
      }
      it.onBoard = true;
      this.board.push(it);
    }
    this.layoutBoard();
    this.updateOk();
  }

  moveHome(it, onComplete) {
    this.tweens.killTweensOf(it.c);
    it.c.setDepth(D.moving);
    this.tweens.add({
      targets: it.c, x: it.home.x, y: it.home.y, scaleX: it.base, scaleY: it.base, duration: dur(350), ease: 'Cubic.easeInOut',
      onComplete: () => { it.c.setDepth(D.fish); onComplete?.(); },
    });
  }

  // Every board fish slides to its slot.
  layoutBoard(onComplete) {
    const n = this.board.length;
    if (n === 0) { onComplete?.(); return; }
    let left = n;
    this.board.forEach((it, i) => {
      const p = this.slot(i, n);
      this.tweens.killTweensOf(it.c);
      it.c.setDepth(D.moving);
      this.tweens.add({
        targets: it.c, x: p.x, y: p.y, scaleX: it.base * BOARD_ZOOM, scaleY: it.base * BOARD_ZOOM,
        duration: dur(350), ease: 'Cubic.easeInOut',
        onComplete: () => { it.c.setDepth(D.fish); if (--left === 0) onComplete?.(); },
      });
    });
  }

  updateOk() {
    if (!this.okButton) return;
    const on = this.board.length > 0 && this.phase !== 'busy';
    this.okButton.setAlpha(on ? 1 : 0.5);
    if (on) this.okButton.setInteractive({ useHandCursor: true });
    else this.okButton.disableInteractive();
  }

  // ↺: every board fish goes back to the cooler.
  clearBoard() {
    if (this.phase !== 'idle') return;
    for (const it of this.board) { it.onBoard = false; this.moveHome(it); }
    this.board = [];
    this.updateOk();
  }

  // ---- checking ----

  onOk() {
    if (this.phase !== 'idle' || this.board.length === 0) return;
    this.phase = 'busy';
    this.updateOk();
    const order = this.round.order;
    const chosen = this.board.map((it) => it.fish);
    const cuisine = isExactCombination(chosen, order);
    if (cuisine) {
      sparkle(this, BOARD.x, BOARD.y);
      this.time.delayedCall(dur(700), () => this.finish(chosen, true));
      return;
    }
    this.showRight(order);
  }

  // Wrong: the board clears, then the right combination slides on with a glow.
  showRight(order) {
    const right = suggestCombination(getState().stock, order, this.level);
    if (right.length === 0) {
      // Cannot happen (the order was drawn from this stock); go on with her choice.
      this.finish(this.board.map((it) => it.fish), false);
      return;
    }
    const ids = right.map((f) => f.id);
    const wrong = this.board.filter((it) => !ids.includes(it.fish.id));
    this.board = this.board.filter((it) => ids.includes(it.fish.id));
    this.time.delayedCall(dur(500), () => {
      let left = wrong.length;
      const bringRight = () => {
        for (const it of this.items) {
          if (ids.includes(it.fish.id) && !it.onBoard) { it.onBoard = true; this.board.push(it); }
        }
        this.layoutBoard(() => {
          this.glow();
          this.time.delayedCall(dur(1800), () => this.finish(right, false));
        });
      };
      if (left === 0) { bringRight(); return; }
      for (const it of wrong) {
        it.onBoard = false;
        this.moveHome(it, () => { if (--left === 0) bringRight(); });
      }
    });
  }

  glow() {
    for (const it of this.board) {
      const g = this.add.ellipse(it.c.x, it.c.y + 12, 190, 150, 0xffeb3b, 0.7).setDepth(D.glow);
      this.tweens.add({ targets: g, alpha: 0.2, scale: 1.1, duration: dur(400), yoyo: true, repeat: 2 });
      this.glows.push(g);
    }
    sparkle(this, BOARD.x, BOARD.y);
  }

  // The combination used leaves the cooler now, then the cutting starts.
  finish(fish, cuisine) {
    const round = this.round;
    const ids = fish.map((f) => f.id);
    updateState((s) => ({ ...s, stock: removeFish(s.stock, ids) }));
    round.chosen = fish.map((f) => ({ ...f }));
    round.results.orders[round.orderIndex] = { cuisine, decoupe: true, dressage: true };
    goTo(this, 'Cut');
  }

  // Fades out, then opens the collection home (the game is two levels below it).
  goHome() {
    if (this.__leaving) return;
    this.__leaving = {};
    this.cameras.main.once('camerafadeoutcomplete', () => { window.location.href = HOME_URL; });
    this.cameras.main.fadeOut(250);
  }
}
