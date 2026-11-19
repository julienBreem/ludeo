// Dough (theme `nombres`): drag the ingredients (intruders included) into the bowl, then stir with
// the whisk. The recipe (logic/recipe.js) is generated once per round at the phase's level and kept
// on the round (↺ keeps it). Each poured ingredient's empty packaging flies onto the board beside
// the bowl, one lane per kind, eggs' shells into the egg boxes (a second box after 10): that is her
// only feedback, nothing is counted or grouped for her. N1: the card shows dice; N2: digits and one
// "a + b"; N3: one complement (what is already in the bowl sits on the tray, the card shows "n" with
// the tray and its number), sometimes "×2", sums. The 5-egg carton is on the shelf at N2-N3.
import { W, H, OUTLINE, BATTER } from '../config.js';
import { getRound } from '../game-state.js';
import { INGREDIENTS } from '../logic/catalog.js';
import { makeRecipe, pourCap } from '../logic/recipe.js';
import { createStirTracker } from '../logic/stir.js';
import { judgeDough } from '../logic/scoring.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { goNext, restart } from '../ui/flow.js';
import { splash, flourPuff, popIn } from '../ui/fx.js';
import { dur } from '../ui/pace.js';

const BOWL_X = 270;
const BOWL_Y = 450; // bowl image centre
const BS = 0.8; // bowl scale
const OPEN_X = BOWL_X; // opening centre (frame 260,116 of a 520x360 image)
const OPEN_Y = BOWL_Y + (116 - 180) * BS;
const DROP_RX = 290 * BS;
const DROP_RY = 190 * BS;
const STIR_RX = 330 * BS;
const STIR_RY = 170 * BS;
const RING_RX = 262 * BS;
const RING_RY = 76 * BS;
const SHELF_Y = 725;
const ICON = 112;
const BOX5_W = 184; // egg-box-5 on the shelf (200x120 frame at 0.92)
const WHISK_SCALE = 0.8;
const WHISK_HOME = { x: 640, y: 470 };
const LEVEL_MAX = 8;
const INK = '#222222';
const TINT = { chocolat: 0x6d4022, lait: 0xfffaf0 };
// Board (plate-side 420x300, art-geometry.md): area for the empties x 30..390, y 28..248.
const BOARD = { x: 1030, y: 350, s: 1.1 };
// Egg boxes (egg-box 400x200): 2 rows of 5 cells; the second box shows after 10 shells.
const EGG_BOXES = [{ x: 620, y: 580 }, { x: 945, y: 580 }];
const EGG_BOX_SCALE = 0.78;
const CELL_X = [52, 126, 200, 274, 348];
const CELL_Y = [62, 130];
// Tray (260x120): what is already in the bowl (N3), items at scale 0.4 on y 47, pitch 36.
const TRAY = { x: 150, y: 262 };
const CARD_TOP = 16;
const BADGE = 0xff4f9a;
const PILL_FILL = 0xe4d9ff;
const PILL_LINE = 0x6a3fd6;
const FONT = 'Arial Black, Arial, sans-serif';

// Shelf x of each item: the six ingredients, and at N2-N3 the 5-egg carton after the egg.
function shelfLayout(level) {
  if (level < 2) return INGREDIENTS.map((key, i) => ({ key, x: 250 + i * 156 }));
  const rest = INGREDIENTS.filter(k => k !== 'oeuf').map((key, i) => ({ key, x: 556 + i * 122 }));
  return [{ key: 'oeuf', x: 222 }, { key: 'oeuf5', x: 376 }, ...rest];
}

// Board frame point -> screen.
const boardX = fx => BOARD.x + (fx - 210) * BOARD.s;
const boardY = fy => BOARD.y + (fy - 150) * BOARD.s;

// Slot j of a lane holding n empties (frame units of the board): scale, x. Up to 5 they are big; up
// to 10 smaller, with a little gap after the 5th (like the carton's rows of five).
function laneSlot(j, n) {
  if (n <= 5) return { scale: 0.5, x: 66 + j * 66 };
  return { scale: 0.36, x: 48 + j * 32 + (j >= 5 ? 10 : 0) };
}

// Screen centre of egg cell i (0..19): back row left to right, then the front row; box 2 after 10.
function cellPos(i) {
  const box = EGG_BOXES[Math.floor(i / 10)];
  const c = i % 10;
  const fx = CELL_X[c % 5];
  const fy = CELL_Y[Math.floor(c / 5)] - 4;
  return { x: box.x + (fx - 200) * EGG_BOX_SCALE, y: box.y + (fy - 100) * EGG_BOX_SCALE };
}

function inside(x, y, rx, ry) {
  return ((x - OPEN_X) / rx) ** 2 + ((y - OPEN_Y) / ry) ** 2 <= 1;
}

export class DoughScene extends Phaser.Scene {
  constructor() {
    super('Dough');
  }

  create() {
    const round = getRound();
    this.round = round;
    if (window.__game) window.__round = round;
    this.dessert = round.order.dessert;
    this.level = round.levels?.pate ?? 1;
    round.recipe ??= makeRecipe(this.dessert, this.level, Math.random);
    this.recipe = round.recipe;
    this.added = {};
    this.prefilledTotal = Object.values(this.recipe.prefilled).reduce((a, b) => a + b, 0);
    this.total = this.prefilledTotal; // in the bowl (batter height)
    this.poured = 0;
    this.empties = {}; // kind -> empty images on the board (non-egg)
    this.shells = []; // shell images in the egg boxes
    this.laneKinds = Object.keys(this.recipe.target).filter(k => k !== 'oeuf')
      .sort((a, b) => INGREDIENTS.indexOf(a) - INGREDIENTS.indexOf(b));
    this.tracker = createStirTracker(OPEN_X, OPEN_Y);
    this.batterColor = BATTER;
    this.drag = null;
    this.stirring = false;
    this.lastAngle = null;

    this.cameras.main.setBackgroundColor(0xfff3e0);
    addOrderReminder(this, round.order, 'pate', round.levels?.commande);
    this.drawShelf();
    this.drawRecipeCard();
    this.drawBoard();

    this.add.image(BOWL_X, BOWL_Y, 'bowl').setScale(BS).setDepth(10);
    this.batter = this.add.ellipse(OPEN_X, OPEN_Y + 8 * BS, 400 * BS, 96 * BS, BATTER).setDepth(11).setVisible(false);
    this.swirlBox = this.add.container(OPEN_X, OPEN_Y + 8 * BS).setDepth(12).setScale(BS, 0.24 * BS).setVisible(false);
    this.swirl = this.add.graphics();
    this.swirlBox.add(this.swirl);
    this.drawSwirl();
    this.ring = this.add.graphics().setDepth(13);
    this.drawTray();
    if (this.total > 0) this.raiseBatter(null, false);

    this.whisk = this.add.image(WHISK_HOME.x, WHISK_HOME.y, 'whisk')
      .setOrigin(0.5, 0.96).setScale(WHISK_SCALE).setDepth(30).setVisible(false);
    this.whisk.setInteractive({ useHandCursor: true });
    this.whisk.on('pointerdown', p => this.startStir(p));

    this.input.on('pointermove', p => this.onMove(p));
    this.input.on('pointerup', p => this.onUp(p));
    this.input.on('pointerupoutside', p => this.onUp(p));

    this.bar = addStepBar(this, { onRestart: () => restart(this), onValidate: () => this.validate() });
  }

  drawShelf() {
    this.add.rectangle(W / 2, H - 70, W, 140, 0xc98a4b).setDepth(1);
    this.add.rectangle(W / 2, H - 140, W, 10, 0xe0a766).setDepth(1);
    this.shelf = {};
    for (const { key, x } of shelfLayout(this.level)) {
      this.shelf[key] = x;
      const img = key === 'oeuf5'
        ? this.add.image(x, SHELF_Y, 'egg-box-5').setScale(BOX5_W / 200)
        : this.add.image(x, SHELF_Y, `ing-${key}`).setDisplaySize(ICON, ICON);
      img.setDepth(5).setInteractive({ useHandCursor: true });
      img.on('pointerdown', p => this.startDrag(p, key, x));
    }
  }

  // The recipe card, top right: one column per kind (ingredient picture, then its number as dice /
  // digit / "a + b" / complement with the tray pill), and the "×2" badge on its corner.
  drawRecipeCard() {
    const { display, prefilled, double } = this.recipe;
    const cols = Object.keys(display).map(k => this.recipeColumn(k, display[k], prefilled[k] ?? 0));
    const pad = 14;
    const gap = 14;
    const w = cols.reduce((a, c) => a + c.w, 0) + gap * (cols.length - 1) + 2 * pad;
    const hasPill = cols.some(c => c.pill);
    const h = hasPill ? 150 : 112;
    const x0 = W - 16 - w;
    const g = this.add.graphics().setDepth(400);
    g.fillStyle(0xffffff, 1).fillRoundedRect(x0, CARD_TOP, w, h, 20);
    g.lineStyle(4, OUTLINE, 1).strokeRoundedRect(x0, CARD_TOP, w, h, 20);
    let x = x0 + pad;
    for (const c of cols) {
      c.box.setPosition(x + c.w / 2, CARD_TOP).setDepth(401);
      x += c.w + gap;
    }
    this.cardBounds = { x: x0, y: CARD_TOP, w, h };
    if (double) {
      const b = this.add.container(x0 + 4, CARD_TOP + 8).setDepth(402);
      const bg = this.add.graphics();
      bg.fillStyle(BADGE, 1).fillCircle(0, 0, 30);
      bg.lineStyle(4, 0xffffff, 1).strokeCircle(0, 0, 30);
      bg.lineStyle(3, OUTLINE, 1).strokeCircle(0, 0, 33);
      b.add(bg);
      b.add(this.add.text(0, 1, '×2', { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5));
      this.doubleBadge = b;
    }
  }

  // One card column, built around x = 0 (top at y = 0): {box, w, pill}.
  recipeColumn(key, disp, pre) {
    const box = this.add.container(0, 0);
    box.add(this.add.image(0, 42, `ing-${key}`).setDisplaySize(60, 60));
    let w = 72;
    if (disp.kind === 'dice') {
      box.add(this.add.image(0, 92, `dice-${disp.n}`).setDisplaySize(56, 56));
    } else {
      const label = disp.kind === 'sum' ? `${disp.a} + ${disp.b}` : String(disp.n);
      const t = this.add.text(0, 94, label, { fontFamily: FONT, fontSize: '30px', color: INK }).setOrigin(0.5);
      box.add(t);
      w = Math.max(w, t.width + 8);
    }
    let pill = false;
    if (disp.kind === 'complement') {
      // what is already in the bowl: the tray and its number
      pill = true;
      const t = this.add.text(0, 0, String(pre), { fontFamily: FONT, fontSize: '24px', color: '#3b2a7a' }).setOrigin(0, 0.5);
      const pw = 60 + 6 + t.width + 22;
      const py = 130;
      const g = this.add.graphics();
      g.fillStyle(PILL_FILL, 1).fillRoundedRect(-pw / 2, py - 17, pw, 34, 17);
      g.lineStyle(3, PILL_LINE, 1).strokeRoundedRect(-pw / 2, py - 17, pw, 34, 17);
      box.add(g);
      box.add(this.add.image(-pw / 2 + 12 + 30, py, 'tray').setScale(0.23));
      t.setPosition(-pw / 2 + 12 + 60 + 6, py + 1);
      box.add(t);
      w = Math.max(w, pw);
    }
    return { box, w, pill };
  }

  drawBoard() {
    this.add.image(BOARD.x, BOARD.y, 'plate-side').setScale(BOARD.s).setDepth(3);
    this.eggBoxes = EGG_BOXES.map(b => this.add.image(b.x, b.y, 'egg-box').setScale(EGG_BOX_SCALE).setDepth(4));
    this.eggBoxes[1].setVisible(false);
  }

  // N3: what is already in the bowl, as its empties on the tray above the bowl.
  drawTray() {
    const entries = Object.entries(this.recipe.prefilled).filter(([, n]) => n > 0);
    if (!entries.length) return;
    this.tray = this.add.image(TRAY.x, TRAY.y, 'tray').setDepth(14);
    const keys = entries.flatMap(([k, n]) => Array(n).fill(k));
    keys.forEach((k, j) => {
      const fx = 130 + (j - (keys.length - 1) / 2) * 36;
      this.add.image(TRAY.x + fx - 130, TRAY.y + 47 - 60, `empty-${k}`).setScale(0.4).setDepth(15);
    });
  }

  // Places every empty on the board: one lane per kind (recipe kinds, then intruders as they come),
  // lanes centred in the board's area. Images already there glide to their new slot.
  layoutBoard() {
    const n = this.laneKinds.length;
    const pitch = Math.min(72, 220 / Math.max(3, n));
    this.laneKinds.forEach((k, i) => {
      const fy = 138 + (i - (n - 1) / 2) * pitch;
      const list = this.empties[k] ?? [];
      const count = Math.max(list.length, this.added[k] ?? 0);
      list.forEach((img, j) => {
        const slot = laneSlot(j, count);
        const scale = Math.min(slot.scale, (pitch * 0.95) / 120) * BOARD.s;
        this.tweens.add({ targets: img, x: boardX(slot.x), y: boardY(fy), scale, duration: dur(300), ease: 'Quad.easeOut' });
      });
    });
  }

  // The empty of one poured ingredient flies from the bowl to the board / egg box.
  addEmpty(key) {
    if (key === 'oeuf') {
      const i = this.shells.length;
      const pos = cellPos(i);
      const img = this.add.image(OPEN_X, OPEN_Y - 40, 'empty-oeuf').setScale(0.4).setDepth(20);
      this.shells.push(img);
      this.tweens.add({ targets: img, x: pos.x, y: pos.y, scale: 0.6 * EGG_BOX_SCALE, duration: dur(420), ease: 'Quad.easeOut' });
      return;
    }
    if (!this.laneKinds.includes(key)) this.laneKinds.push(key); // an intruder gets its lane
    const img = this.add.image(OPEN_X, OPEN_Y - 40, `empty-${key}`).setScale(0.4).setDepth(20);
    (this.empties[key] ??= []).push(img);
    this.layoutBoard();
  }

  // Before a pour: is there room for n more of that kind (board lane, egg boxes)?
  hasRoom(key, n) {
    return (this.added[key] ?? 0) + n <= pourCap(key);
  }

  drawSwirl() {
    const g = this.swirl;
    g.clear();
    g.lineStyle(14, 0xffffff, 0.35);
    for (let arm = 0; arm < 2; arm++) {
      g.beginPath();
      for (let t = 0; t <= 1.001; t += 0.05) {
        const a = arm * Math.PI + t * Math.PI * 2.2;
        const r = 20 + t * 150;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (t === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokePath();
    }
  }

  startDrag(p, key, homeX) {
    if (this.drag || this.stirring) return;
    const img = key === 'oeuf5'
      ? this.add.image(p.x, p.y, 'egg-box-5').setScale((BOX5_W / 200) * 1.1).setDepth(40)
      : this.add.image(p.x, p.y, `ing-${key}`).setDisplaySize(ICON * 1.15, ICON * 1.15).setDepth(40);
    this.drag = { key, img, homeX, id: p.id };
  }

  startStir(p) {
    if (this.drag || this.stirring) return;
    this.stirring = true;
    this.lastAngle = null;
    this.moveWhisk(p);
  }

  moveWhisk(p) {
    this.whisk.setPosition(p.x, p.y);
    if (inside(p.x, p.y, STIR_RX, STIR_RY)) {
      this.tracker.addPoint(p.x, p.y);
      const a = Math.atan2(p.y - OPEN_Y, p.x - OPEN_X);
      if (this.lastAngle !== null) {
        let d = a - this.lastAngle;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d <= -Math.PI) d += 2 * Math.PI;
        this.swirl.rotation += d;
      }
      this.lastAngle = a;
      this.drawRing();
    } else {
      this.tracker.breakStroke();
      this.lastAngle = null;
    }
  }

  drawRing() {
    const g = this.ring;
    g.clear();
    const prog = this.tracker.progress();
    if (prog <= 0) return;
    g.lineStyle(12, 0x66bb6a, 1);
    g.beginPath();
    const steps = Math.max(2, Math.round(prog * 80));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * prog * Math.PI * 2;
      const px = OPEN_X + Math.cos(a) * RING_RX;
      const py = OPEN_Y + 8 * BS + Math.sin(a) * RING_RY;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.strokePath();
  }

  onMove(p) {
    if (this.drag && p.id === this.drag.id) this.drag.img.setPosition(p.x, p.y);
    else if (this.stirring) this.moveWhisk(p);
  }

  onUp(p) {
    if (this.drag && p.id === this.drag.id) {
      const { key, img, homeX } = this.drag;
      this.drag = null;
      const box5 = key === 'oeuf5';
      const ing = box5 ? 'oeuf' : key;
      if (inside(p.x, p.y, DROP_RX, DROP_RY) && this.hasRoom(ing, box5 ? 5 : 1)) {
        if (box5) this.addEggBox(img);
        else this.addIngredient(key, img);
      } else {
        this.tweens.add({
          targets: img, x: homeX, y: SHELF_Y, duration: 220, ease: 'Quad.easeOut',
          onComplete: () => img.destroy(),
        });
      }
    } else if (this.stirring) {
      this.stirring = false;
      this.tracker.breakStroke();
      this.lastAngle = null;
      this.tweens.add({ targets: this.whisk, x: WHISK_HOME.x, y: WHISK_HOME.y, duration: 250, ease: 'Quad.easeOut' });
    }
  }

  // Counts n of key as poured (now, so a quick ✓ sees it) and shows the second egg box if needed.
  count(key, n) {
    this.added[key] = (this.added[key] ?? 0) + n;
    this.total += n;
    this.poured += n;
    if (key === 'oeuf' && this.added.oeuf > 10 && !this.eggBoxes[1].visible) {
      this.eggBoxes[1].setVisible(true);
      popIn(this, this.eggBoxes[1]);
    }
    return this.poured === n; // first pour
  }

  firstPour() {
    this.whisk.setVisible(true);
    popIn(this, this.whisk);
    this.bar.setValidateEnabled(true);
  }

  addIngredient(key, img) {
    const first = this.count(key, 1);
    const surfaceY = OPEN_Y + 8 * BS;
    const land = () => {
      img.destroy();
      if (key === 'farine' || key === 'sucre') flourPuff(this, OPEN_X, surfaceY - 30);
      else splash(this, OPEN_X, surfaceY - 10, key === 'chocolat' ? TINT.chocolat : 0xffe9ae);
      this.raiseBatter(key);
      this.addEmpty(key);
      if (first) this.firstPour();
    };
    this.tweens.add({
      targets: img, x: OPEN_X, y: OPEN_Y - 70, duration: 180, ease: 'Quad.easeOut',
      onComplete: () => (key === 'oeuf' ? this.crackEgg(img, land) : this.tweens.add({
        targets: img, y: surfaceY - 20, scale: img.scale * 0.5, alpha: 0, duration: 220, ease: 'Quad.easeIn', onComplete: land,
      })),
    });
  }

  // The 5-egg carton: five eggs at once, five shells into the egg boxes one after the other.
  addEggBox(img) {
    const first = this.count('oeuf', 5);
    const surfaceY = OPEN_Y + 8 * BS;
    this.tweens.add({
      targets: img, x: OPEN_X, y: OPEN_Y - 60, duration: 180, ease: 'Quad.easeOut',
      onComplete: () => this.tweens.add({
        targets: img, y: surfaceY - 10, scale: img.scale * 0.6, alpha: 0, duration: dur(260), ease: 'Quad.easeIn',
        onComplete: () => {
          img.destroy();
          splash(this, OPEN_X, surfaceY - 10, 0xffe9ae);
          this.raiseBatter('oeuf');
          for (let k = 0; k < 5; k++) this.time.delayedCall(dur(k * 90), () => this.addEmpty('oeuf'));
          if (first) this.firstPour();
        },
      }),
    });
  }

  crackEgg(egg, land) {
    const s = egg.scaleX;
    const left = this.add.image(egg.x, egg.y, 'ing-oeuf').setScale(s).setDepth(40).setCrop(0, 0, 80, 160);
    const right = this.add.image(egg.x, egg.y, 'ing-oeuf').setScale(s).setDepth(40).setCrop(80, 0, 80, 160);
    egg.setVisible(false);
    this.tweens.add({ targets: left, x: egg.x - 44, y: egg.y + 40, angle: -40, alpha: 0, duration: 320, ease: 'Quad.easeIn', onComplete: () => left.destroy() });
    this.tweens.add({
      targets: right, x: egg.x + 44, y: egg.y + 40, angle: 40, alpha: 0, duration: 320, ease: 'Quad.easeIn',
      onComplete: () => { right.destroy(); land(); },
    });
  }

  raiseBatter(key, animate = true) {
    const k = Math.min(this.total, LEVEL_MAX);
    if (key && !(key in this.recipe.target) && TINT[key] !== undefined) {
      const a = Phaser.Display.Color.ValueToColor(this.batterColor);
      const b = Phaser.Display.Color.ValueToColor(TINT[key]);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, 30);
      this.batterColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    }
    this.batter.setFillStyle(this.batterColor, 1).setVisible(true);
    this.swirlBox.setVisible(true);
    const sc = 0.55 + 0.45 * (k / LEVEL_MAX);
    const y = OPEN_Y + 8 * BS - k * 2 * BS;
    if (!animate) {
      this.batter.setScale(sc).setY(y);
      this.swirlBox.setY(y);
      return;
    }
    this.tweens.add({ targets: this.batter, scaleX: sc, scaleY: sc, y, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.swirlBox, y, duration: 250 });
  }

  validate() {
    const { target, prefilled } = this.recipe;
    const result = judgeDough(this.added, this.tracker.progress(), this.dessert, target, prefilled);
    this.round.results.pate = result;
    this.round.doughAdded = { ...this.added };
    this.round.cake.doughOk = result.ok;
    goNext(this);
  }
}
