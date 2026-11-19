// Dough: drag the six ingredients (intruders included) into the bowl, then stir with the whisk.
import { W, H, OUTLINE, BATTER } from '../config.js';
import { getRound } from '../game-state.js';
import { INGREDIENTS, DESSERTS } from '../logic/catalog.js';
import { createStirTracker } from '../logic/stir.js';
import { judgeDough } from '../logic/scoring.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { goNext } from '../ui/flow.js';
import { splash, flourPuff, popIn } from '../ui/fx.js';

const BOWL_X = 520;
const BOWL_Y = 460; // bowl image centre
const OPEN_X = BOWL_X - 260 + 260; // opening centre (frame 260,116 of a 520x360 image)
const OPEN_Y = BOWL_Y - 180 + 116;
const DROP_RX = 290;
const DROP_RY = 190;
const STIR_RX = 330;
const STIR_RY = 170;
const RING_RX = 262;
const RING_RY = 76;
const SHELF_Y = 725;
const SHELF_X0 = 250;
const SHELF_STEP = 156;
const ICON = 112;
const WHISK_SCALE = 0.8;
const WHISK_HOME = { x: 980, y: 640 };
const LEVEL_MAX = 8;
const INK = '#222222';
const TINT = { chocolat: 0x6d4022, lait: 0xfffaf0 };

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
    this.added = {};
    this.total = 0;
    this.tracker = createStirTracker(OPEN_X, OPEN_Y);
    this.batterColor = BATTER;
    this.drag = null;
    this.stirring = false;
    this.lastAngle = null;

    this.cameras.main.setBackgroundColor(0xfff3e0);
    addOrderReminder(this, round.order);
    this.drawShelf();
    this.drawRecipeCard();

    this.add.image(BOWL_X, BOWL_Y, 'bowl').setDepth(10);
    this.batter = this.add.ellipse(OPEN_X, OPEN_Y + 8, 400, 96, BATTER).setDepth(11).setVisible(false);
    this.swirlBox = this.add.container(OPEN_X, OPEN_Y + 8).setDepth(12).setScale(1, 0.24).setVisible(false);
    this.swirl = this.add.graphics();
    this.swirlBox.add(this.swirl);
    this.drawSwirl();
    this.ring = this.add.graphics().setDepth(13);

    this.whisk = this.add.image(WHISK_HOME.x, WHISK_HOME.y, 'whisk')
      .setOrigin(0.5, 0.96).setScale(WHISK_SCALE).setDepth(30).setVisible(false);
    this.whisk.setInteractive({ useHandCursor: true });
    this.whisk.on('pointerdown', p => this.startStir(p));

    this.input.on('pointermove', p => this.onMove(p));
    this.input.on('pointerup', p => this.onUp(p));
    this.input.on('pointerupoutside', p => this.onUp(p));

    this.bar = addStepBar(this, { onRestart: () => this.scene.restart(), onValidate: () => this.validate() });
  }

  drawShelf() {
    this.add.rectangle(W / 2, H - 70, W, 140, 0xc98a4b).setDepth(1);
    this.add.rectangle(W / 2, H - 140, W, 10, 0xe0a766).setDepth(1);
    INGREDIENTS.forEach((key, i) => {
      const x = SHELF_X0 + i * SHELF_STEP;
      const img = this.add.image(x, SHELF_Y, `ing-${key}`).setDisplaySize(ICON, ICON).setDepth(5);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', p => this.startDrag(p, key, x));
    });
  }

  drawRecipeCard() {
    const entries = Object.entries(DESSERTS[this.dessert].recipe);
    const cell = 104;
    const w = entries.length * cell + 20;
    const x0 = W - 16 - w;
    const g = this.add.graphics().setDepth(400);
    g.fillStyle(0xffffff, 1).fillRoundedRect(x0, 16, w, 108, 20);
    g.lineStyle(4, OUTLINE, 1).strokeRoundedRect(x0, 16, w, 108, 20);
    entries.forEach(([key, n], i) => {
      const cx = x0 + 10 + cell * i + cell / 2;
      this.add.image(cx, 54, `ing-${key}`).setDisplaySize(64, 64).setDepth(401);
      this.add.text(cx, 100, `×${n}`, { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '30px', color: INK })
        .setOrigin(0.5).setDepth(401);
    });
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
    const img = this.add.image(p.x, p.y, `ing-${key}`).setDisplaySize(ICON * 1.15, ICON * 1.15).setDepth(40);
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
    g.lineStyle(14, 0x66bb6a, 1);
    g.beginPath();
    const steps = Math.max(2, Math.round(prog * 80));
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (i / steps) * prog * Math.PI * 2;
      const px = OPEN_X + Math.cos(a) * RING_RX;
      const py = OPEN_Y + 8 + Math.sin(a) * RING_RY;
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
      if (inside(p.x, p.y, DROP_RX, DROP_RY)) {
        this.addIngredient(key, img);
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

  addIngredient(key, img) {
    this.added[key] = (this.added[key] ?? 0) + 1;
    this.total++;
    const first = this.total === 1;
    const surfaceY = OPEN_Y + 8;
    const done = () => {
      this.raiseBatter(key);
      if (first) {
        this.whisk.setVisible(true);
        popIn(this, this.whisk);
        this.bar.setValidateEnabled(true);
      }
    };
    const land = () => {
      img.destroy();
      if (key === 'farine' || key === 'sucre') flourPuff(this, OPEN_X, surfaceY - 30);
      else splash(this, OPEN_X, surfaceY - 10, key === 'chocolat' ? TINT.chocolat : 0xffe9ae);
      done();
    };
    this.tweens.add({
      targets: img, x: OPEN_X, y: OPEN_Y - 70, duration: 180, ease: 'Quad.easeOut',
      onComplete: () => (key === 'oeuf' ? this.crackEgg(img, land) : this.tweens.add({
        targets: img, y: surfaceY - 20, scale: img.scale * 0.5, alpha: 0, duration: 220, ease: 'Quad.easeIn', onComplete: land,
      })),
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

  raiseBatter(key) {
    const k = Math.min(this.total, LEVEL_MAX);
    if (!(key in DESSERTS[this.dessert].recipe) && TINT[key] !== undefined) {
      const a = Phaser.Display.Color.ValueToColor(this.batterColor);
      const b = Phaser.Display.Color.ValueToColor(TINT[key]);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, 30);
      this.batterColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    }
    this.batter.setFillStyle(this.batterColor, 1).setVisible(true);
    this.swirlBox.setVisible(true);
    this.tweens.add({
      targets: this.batter, scaleX: 0.55 + 0.45 * (k / LEVEL_MAX), scaleY: 0.55 + 0.45 * (k / LEVEL_MAX),
      y: OPEN_Y + 8 - k * 2, duration: 250, ease: 'Back.easeOut',
    });
    this.tweens.add({ targets: this.swirlBox, y: OPEN_Y + 8 - k * 2, duration: 250 });
  }

  validate() {
    const result = judgeDough(this.added, this.tracker.progress(), this.dessert);
    this.round.results.pate = result;
    this.round.doughAdded = { ...this.added };
    this.round.cake.doughOk = result.ok;
    goNext(this);
  }
}
