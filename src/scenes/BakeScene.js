// Bake: choose the heat, start the oven, take the cake out at the right time (unmold).
import { W, H, OUTLINE } from '../config.js';
import { getRound } from '../game-state.js';
import { DESSERTS } from '../logic/catalog.js';
import { createBakeTimer, bakeState, GREEN_MIN, GREEN_MAX } from '../logic/bake.js';
import { judgeBake } from '../logic/scoring.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { addIconButton } from '../ui/button.js';
import { drawCake } from '../ui/cakeView.js';
import { goNext, restart } from '../ui/flow.js';
import { steam, smoke, heatRise } from '../ui/fx.js';

const OVEN_X = 420;
const OVEN_Y = 440;
const CAKE_SIZE = 300;
const CAKE_DX = 0;
const CAKE_DY = 40; // cake centre below the oven centre
const WIN_X = OVEN_X - 192;
const WIN_Y = OVEN_Y - 75;
const WIN_W = 384;
const WIN_H = 238;
const GAUGE_X = 760;
const GAUGE_TOP = 190;
const GAUGE_BOT = 660;
const GAUGE_W = 56;
const HEAT_X = [900, 1030, 1160];
const HEAT_Y = 290;
const HEAT_BOX = 120;
const GO_X = 1030;
const GO_Y = 520;
const RISE_END = GREEN_MIN;
// ▶ and the oven mitt are the same button: a double tap must not start and take out at once.
const TAKE_OUT_GUARD_MS = 700;

export class BakeScene extends Phaser.Scene {
  constructor() {
    super('Bake');
  }

  create() {
    const round = getRound();
    this.round = round;
    if (window.__game) window.__round = round;
    this.target = DESSERTS[round.order.dessert].heat;
    this.heat = null;
    this.phase = 'idle'; // idle -> ready (heat chosen) -> baking -> out
    this.timer = null;
    this.heatBtns = [];
    this.startedAt = 0;
    this.finalGauge = null;
    this.unmolded = null;
    this.glowTween = null;
    this.heatEvent = null;

    this.cameras.main.setBackgroundColor(0xffebee);
    const reminder = addOrderReminder(this, round.order);
    // divider, so the topping digit does not seem to count the flames
    const sep = this.add.graphics();
    sep.fillStyle(OUTLINE, 0.25).fillRoundedRect(-3, -34, 6, 68, 3);
    reminder.append(sep, 34);
    for (let i = 0; i < this.target; i++) {
      const f = this.add.image(0, 0, 'flame');
      f.setScale(56 / f.height);
      reminder.append(f, i === this.target - 1 ? 58 : 38);
    }

    this.add.image(OVEN_X, OVEN_Y, 'oven');
    this.cake = drawCake(this, OVEN_X + CAKE_DX, OVEN_Y + CAKE_DY, { ...round.cake, bake: null, glaze: null, toppings: [] },
      { size: CAKE_SIZE, view: '3q', inMold: true, bakeGauge: 0 });
    this.cake.setBakeGauge(0);
    this.setRise(0);
    this.glow = this.add.rectangle(WIN_X + WIN_W / 2, WIN_Y + WIN_H / 2, WIN_W, WIN_H, 0xff8a30, 0.0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(5);

    this.drawGauge();
    this.drawHeatButtons();
    this.go = addIconButton(this, GO_X, GO_Y, 'icon-go', () => this.onGo(), { size: 150 });
    this.setGoEnabled(false);

    this.bar = addStepBar(this, { onRestart: () => restart(this), onValidate: () => this.validate() });
  }

  setRise(g) {
    const f = 0.85 + 0.15 * Math.min(1, g / RISE_END);
    this.cake.top.setScale(f, 0.55 * f);
  }

  drawGauge() {
    const h = GAUGE_BOT - GAUGE_TOP;
    const y = v => GAUGE_BOT - v * h;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.15).fillRoundedRect(GAUGE_X - GAUGE_W / 2 + 3, GAUGE_TOP + 5, GAUGE_W, h, 20);
    g.fillStyle(0xffffff, 1).fillRoundedRect(GAUGE_X - GAUGE_W / 2 - 6, GAUGE_TOP - 6, GAUGE_W + 12, h + 12, 24);
    // brown (top), green, yellow (bottom)
    g.fillStyle(0x8d5524, 1).fillRoundedRect(GAUGE_X - GAUGE_W / 2, GAUGE_TOP, GAUGE_W, y(GREEN_MAX) - GAUGE_TOP + 10, { tl: 18, tr: 18, bl: 0, br: 0 });
    g.fillStyle(0x66bb6a, 1).fillRect(GAUGE_X - GAUGE_W / 2, y(GREEN_MAX), GAUGE_W, y(GREEN_MIN) - y(GREEN_MAX));
    g.fillStyle(0xffd54f, 1).fillRoundedRect(GAUGE_X - GAUGE_W / 2, y(GREEN_MIN), GAUGE_W, GAUGE_BOT - y(GREEN_MIN), { tl: 0, tr: 0, bl: 18, br: 18 });
    g.lineStyle(4, OUTLINE, 1).strokeRoundedRect(GAUGE_X - GAUGE_W / 2, GAUGE_TOP, GAUGE_W, h, 18);
    this.gaugeY = y;
    const p = this.add.graphics();
    p.fillStyle(OUTLINE, 1).fillTriangle(-6, 0, -46, -22, -46, 22);
    p.fillStyle(0xffffff, 1).fillTriangle(-14, 0, -40, -14, -40, 14);
    this.pointer = this.add.container(GAUGE_X - GAUGE_W / 2 - 4, y(0), [p]).setDepth(6);
  }

  drawHeatButtons() {
    for (let k = 1; k <= 3; k++) {
      const x = HEAT_X[k - 1];
      const box = this.add.container(x, HEAT_Y);
      const bg = this.add.graphics();
      box.add(bg);
      const draw = (sel) => {
        bg.clear();
        bg.fillStyle(0x000000, 0.12).fillRoundedRect(-HEAT_BOX / 2 + 3, -HEAT_BOX / 2 + 6, HEAT_BOX, HEAT_BOX, 24);
        bg.fillStyle(sel ? 0xfff9c4 : 0xffffff, 1).fillRoundedRect(-HEAT_BOX / 2, -HEAT_BOX / 2, HEAT_BOX, HEAT_BOX, 24);
        bg.lineStyle(sel ? 10 : 4, sel ? 0x66bb6a : OUTLINE, sel ? 1 : 0.5).strokeRoundedRect(-HEAT_BOX / 2, -HEAT_BOX / 2, HEAT_BOX, HEAT_BOX, 24);
      };
      draw(false);
      const fh = k === 1 ? 64 : k === 2 ? 50 : 40;
      for (let i = 0; i < k; i++) {
        const f = this.add.image((i - (k - 1) / 2) * (k === 3 ? 34 : 44), 0, 'flame');
        f.setScale(fh / f.height);
        box.add(f);
      }
      const zone = this.add.zone(0, 0, HEAT_BOX, HEAT_BOX).setInteractive({ useHandCursor: true });
      box.add(zone);
      zone.on('pointerup', () => this.chooseHeat(k));
      this.heatBtns.push({ box, draw, zone });
    }
  }

  chooseHeat(k) {
    if (this.phase !== 'idle' && this.phase !== 'ready') return;
    this.heat = k;
    this.heatBtns.forEach((b, i) => {
      b.draw(i + 1 === k);
      this.tweens.add({ targets: b.box, scale: i + 1 === k ? 1.1 : 1, duration: 140, ease: 'Back.easeOut' });
    });
    this.phase = 'ready';
    this.setGoEnabled(true);
  }

  setGoEnabled(on) {
    if (on) this.go.clearTint().setAlpha(1).setInteractive({ useHandCursor: true });
    else this.go.setTint(0x9e9e9e).setAlpha(0.6).disableInteractive();
  }

  onGo() {
    if (this.phase === 'ready') this.startBaking();
    else if (this.phase === 'baking' && this.time.now - this.startedAt >= TAKE_OUT_GUARD_MS) this.takeOut();
  }

  startBaking() {
    this.phase = 'baking';
    this.startedAt = this.time.now;
    this.timer = createBakeTimer(this.heat, this.target);
    this.heatBtns.forEach((b) => { b.zone.disableInteractive(); });
    this.heatBtns.forEach((b, i) => { if (i + 1 !== this.heat) b.box.setAlpha(0.45); });
    this.go.setTexture('icon-out');
    this.glowTween = this.tweens.add({ targets: this.glow, alpha: { from: 0.12, to: 0.38 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.heatEvent = this.time.addEvent({ delay: 650, loop: true, callback: () => heatRise(this, OVEN_X, WIN_Y + WIN_H - 20) });
  }

  update(time, delta) {
    if (this.phase !== 'baking') return;
    this.timer.tick(delta); // clamped inside, so a hidden tab or sleep never burns the cake
    const g = this.timer.gauge();
    this.cake.setBakeGauge(g);
    this.setRise(g);
    this.pointer.y = this.gaugeY(g);
  }

  takeOut() {
    this.phase = 'out';
    const g = this.timer.gauge();
    this.finalGauge = g;
    this.heatEvent?.remove();
    this.glowTween?.stop();
    this.tweens.add({ targets: this.glow, alpha: 0, duration: 300 });
    this.setGoEnabled(false);
    const state = bakeState(g);
    const x = OVEN_X;
    const y = WIN_Y + 20;
    steam(this, x, y);
    if (state === 'brule') smoke(this, x, y);

    // Unmold: the finished 3/4 cake takes the place of the in-mold top face, the mold lifts away.
    const plain = drawCake(this, this.cake.x, this.cake.y, { ...this.round.cake, bake: null, glaze: null, toppings: [] },
      { size: CAKE_SIZE, view: '3q', bakeGauge: g });
    const k = this.cake.top.scaleX;
    plain.top.setScale(k, 0.55 * k);
    this.children.moveBelow(plain, this.cake);
    this.cake.top.setVisible(false);
    this.unmolded = plain;
    const lift = 150;
    for (const part of [this.cake.moldBack, this.cake.moldFront]) {
      this.tweens.add({ targets: part, y: part.y - lift, alpha: 0, duration: 650, ease: 'Back.easeIn' });
    }
    this.tweens.add({
      targets: plain, scaleX: plain.scaleX * 1.06, scaleY: plain.scaleY * 1.06, duration: 160, delay: 560, yoyo: true,
    });
    this.bar.setValidateEnabled(true);
  }

  validate() {
    if (this.phase !== 'out') return false;
    const g = this.finalGauge;
    this.round.results.cuisson = judgeBake(g);
    this.round.cake.bake = bakeState(g);
    goNext(this);
  }
}
