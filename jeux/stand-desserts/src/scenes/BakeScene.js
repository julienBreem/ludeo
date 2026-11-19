// Bake: choose the heat, start the oven, take the cake out at the right time (unmold).
// Theme `temps`, level read from the round (kept from the client's arrival):
// N1: a round timer with a green sector (the gauge: take out in the green).
// N2: a timer numbered 1..5; the card says « 3 » (digit + dice): take out when the hand is on 3.
// N3: a clock; the card shows the start time on a small clock and « + 1 h »: she drags the red alarm
//     hand to the end time (the bell and the alarm hand pulse until she does), starts, the hour
//     hand runs (1 h ≈ 6 s x pace), the alarm rings and the oven stops; she takes the cake out. A
//     wrong alarm bakes it too little / too long; one never reached (3 h or more away) stops the
//     oven after duration + CLOCK_EXTRA without ringing.
// The heat (flames) is chosen at every level. N2/N3: golden only with the right flames AND the
// right time (logic/bake.js judgeTimed: wrong flames are never golden).
import { OUTLINE } from '../config.js';
import { getRound } from '../game-state.js';
import { DESSERTS } from '../logic/catalog.js';
import {
  createBakeTimer, bakeState, GREEN_MIN, GREEN_MAX, HALF_HOURS, bakeTarget, bakeWindow, judgeTimed,
  timedGauge, createTimeTimer, angleToAlarm, alarmDelay, clockHours,
} from '../logic/bake.js';
import { ensureTimerTextures, pivotOrigin, TIMER_RUN, CLOCK_MIN_SCALE } from '../ui/timerArt.js';
import { debugFlag } from '../debug.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { addIconButton } from '../ui/button.js';
import { drawCake } from '../ui/cakeView.js';
import { goNext, restart } from '../ui/flow.js';
import { dur, factors } from '../ui/pace.js';
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
// The timer / clock, right of the oven, under the heat buttons.
const DIAL_X = 905;
const DIAL_Y = 565;
const DIAL_K = 0.725; // every layer of the dial at this scale, on the pivot (timerArt.js FRAMES)
const DIAL_HIT = 300; // N3: a disc this wide around the pivot turns the alarm hand (the knob is ~30 px)
const ALARM_ICON_X = 1160;
const ALARM_ICON_Y = 405;
const CARD_H = 112;
const CLOCK_CARD_H = 210; // N3: the start-time clock at CLOCK_MIN_SCALE (its digits stay readable)
const DEG = Math.PI / 180;
const CARD_GAP = 20;
// N2/N3: flames card + time card from here, right of the widest order reminder (Commande N2 word
// strip, ~256 px), and ending above the heat buttons (y 230).
const ROW_X = 272;
const TURN = 2 * Math.PI;
const FONT = 'Arial Black, Arial, sans-serif';
const INK = '#222222';
const HEAT_X = [900, 1030, 1160];
const HEAT_Y = 290;
const HEAT_BOX = 120;
const TARGET_Y = 175;
const TARGET_Y_ROW = 171;
const GO_X = 1160;
const GO_Y = 540;
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
    this.level = round.levels?.cuisson ?? 1;
    // The target is kept on the round: a ↺ restart keeps the same start time (N3).
    if (round.bakeTarget?.level !== this.level) {
      const halfHours = this.level === 3 && (HALF_HOURS || debugFlag('half'));
      round.bakeTarget = bakeTarget(round.order.dessert, this.level, { halfHours });
    }
    this.bt = round.bakeTarget;
    this.target = DESSERTS[round.order.dessert].heat;
    this.win = bakeWindow(this.bt, { greenWindow: factors().greenWindow });
    this.heat = null;
    this.phase = 'idle'; // idle -> ready (heat chosen) -> baking -> out
    this.timer = null;
    this.heatBtns = [];
    this.startedAt = 0;
    this.finalGauge = null;
    this.finalState = null;
    this.unmolded = null;
    this.glowTween = null;
    this.heatEvent = null;
    this.alarm = this.bt.kind === 'clock' ? this.bt.start : null; // N3: on the start time until she sets it
    this.rang = false;
    this.dragging = false;
    // per-run objects (Phaser reuses the scene): never the last run's
    this.ringTween = null;
    this.alarmPulse = null;
    this.alarmHandPulse = null;
    this.alarmZone = null;
    this.alarmHand = null;
    this.alarmIcon = null;
    this.sector = null;
    this.timeCard = null;

    this.cameras.main.setBackgroundColor(0xffebee);
    ensureTimerTextures(this);
    addOrderReminder(this, round.order, 'cuisson', round.levels?.commande);
    this.drawInstructions();

    this.add.image(OVEN_X, OVEN_Y, 'oven');
    this.cake = drawCake(this, OVEN_X + CAKE_DX, OVEN_Y + CAKE_DY, { ...round.cake, bake: null, glaze: null, toppings: [] },
      { size: CAKE_SIZE, view: '3q', inMold: true, bakeGauge: 0 });
    this.cake.setBakeGauge(0);
    this.setRise(0);
    this.glow = this.add.rectangle(WIN_X + WIN_W / 2, WIN_Y + WIN_H / 2, WIN_W, WIN_H, 0xff8a30, 0.0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(5);

    this.drawDial();
    this.drawHeatButtons();
    this.go = addIconButton(this, GO_X, GO_Y, 'icon-go', () => this.onGo(), { size: 150 });
    this.setGoEnabled(false);

    this.bar = addStepBar(this, { onRestart: () => restart(this), onValidate: () => this.validate() });
  }

  // The instructions above the oven: the heat as flames (every level), then at N2 the number to bake
  // until (digit + dice), at N3 the start time on a small clock (« 2 h » beside it) and « + 1 h ».
  drawInstructions() {
    if (this.bt.kind === 'sector') {
      this.targetCard = this.card(OVEN_X, this.flamesContent());
      return;
    }
    const flames = this.flamesContent();
    const time = this.bt.kind === 'number' ? this.numberContent() : this.clockContent();
    this.targetCard = this.card(ROW_X + flames.w / 2, flames, TARGET_Y_ROW);
    this.timeCard = this.card(ROW_X + flames.w + CARD_GAP + time.w / 2, time, TARGET_Y_ROW);
  }

  // A white card centred on x at y (TARGET_Y) around {items, w} (items laid out around x = 0).
  // A taller card (N3 clock) grows upwards: every card ends at the same bottom line.
  card(x, { items, w, h = CARD_H }, y = TARGET_Y) {
    const card = this.add.container(x, y + (CARD_H - h) / 2).setDepth(20);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.15).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 26);
    bg.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    bg.lineStyle(5, 0x66bb6a, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
    card.add([bg, ...items]);
    return card;
  }

  flamesContent() {
    const n = this.target;
    const items = [];
    for (let i = 0; i < n; i++) {
      const f = this.add.image((i - (n - 1) / 2) * 64, 0, 'flame');
      f.setScale(84 / f.height);
      items.push(f);
    }
    return { items, w: 40 + n * 64 };
  }

  // N2: a small numbered timer, the digit, its dice.
  numberContent() {
    const n = this.bt.number;
    const face = this.add.image(-92, 0, 'timer-face-numbers').setOrigin(...pivotOrigin('timer-face-numbers')).setScale(0.19);
    const digit = this.add.text(-10, 2, String(n), { fontFamily: FONT, fontSize: '72px', color: INK }).setOrigin(0.5);
    const dice = this.add.image(78, 0, `dice-${n}`).setDisplaySize(72, 72);
    return { items: [face, digit, dice], w: 252 };
  }

  // N3: the start time on a small clock (never under CLOCK_MIN_SCALE: its digits must stay
  // readable) with « 2 h » beside it, then the duration « + 1 h ».
  clockContent() {
    const { start, duration } = this.bt;
    const k = CLOCK_MIN_SCALE;
    const face = this.add.image(0, 0, 'clock-face').setOrigin(...pivotOrigin('clock-face')).setScale(k);
    const hand = this.add.image(0, 0, 'clock-hour-hand').setOrigin(...pivotOrigin('clock-hour-hand')).setScale(k)
      .setRotation(start * 30 * DEG);
    const at = this.add.text(0, 0, `${start} h`, { fontFamily: FONT, fontSize: '32px', color: '#666666' }).setOrigin(0, 0.5);
    const plus = this.add.text(0, 0, `+ ${duration === 0.5 ? '½' : '1'} h`, { fontFamily: FONT, fontSize: '44px', color: INK }).setOrigin(0, 0.5);
    const fw = face.displayWidth;
    const w = 14 + fw + 8 + at.width + 16 + plus.width + 16;
    const x0 = -w / 2 + 14;
    // the face's pivot sits below its frame centre (bells on top): centre the frame in the card
    const py = (pivotOrigin('clock-face')[1] - 0.5) * face.displayHeight;
    face.setPosition(x0 + fw / 2, py);
    hand.setPosition(x0 + fw / 2, py);
    at.setPosition(x0 + fw + 8, py);
    plus.setPosition(at.x + at.width + 16, py);
    return { items: [face, hand, at, plus], w, h: CLOCK_CARD_H };
  }

  setRise(g) {
    const f = 0.85 + 0.15 * Math.min(1, g / RISE_END);
    this.cake.top.setScale(f, 0.55 * f);
  }

  // The round timer (N1: green sector, N2: numbers) or the clock (N3, with the alarm hand). Every
  // layer at DIAL_K with its pivot on (DIAL_X, DIAL_Y) (timerArt.js FRAMES).
  layer(key) {
    return this.add.image(DIAL_X, DIAL_Y, key).setOrigin(...pivotOrigin(key)).setScale(DIAL_K);
  }

  drawDial() {
    const face = { sector: 'timer-face-sector', number: 'timer-face-numbers', clock: 'clock-face' }[this.bt.kind];
    this.dialFace = this.layer(face);
    if (this.bt.kind === 'sector') this.sector = this.layer('timer-sector'); // the green: gauge 0.45..0.70
    if (this.bt.kind === 'clock') {
      this.alarmHand = this.layer('clock-alarm-hand');
      this.hand = this.layer('clock-hour-hand');
      this.alarmIcon = this.add.image(ALARM_ICON_X, ALARM_ICON_Y, 'icon-alarm').setDisplaySize(84, 84);
      this.showAlarm();
      this.showClock(0);
      // The knob is too small to grab: press or drag anywhere on the dial to turn the alarm hand.
      const zone = this.add.zone(DIAL_X, DIAL_Y, DIAL_HIT, DIAL_HIT)
        .setInteractive(new Phaser.Geom.Circle(DIAL_HIT / 2, DIAL_HIT / 2, DIAL_HIT / 2), Phaser.Geom.Circle.Contains);
      this.alarmZone = zone;
      zone.on('pointerdown', (p) => { this.dragging = true; this.setAlarmFrom(p); });
      this.input.on('pointermove', (p) => { if (this.dragging && p.isDown) this.setAlarmFrom(p); });
      this.input.on('pointerup', () => { this.dragging = false; });
    } else {
      this.hand = this.layer('timer-hand');
    }
  }

  // N3: the hour hand at the start time + the time gone by.
  showClock(elapsed) {
    this.hand.setRotation((this.bt.start + elapsed) * 30 * DEG);
  }

  showAlarm() {
    this.alarmHand.setRotation(this.alarm * 30 * DEG);
  }

  // N3: the alarm follows the finger (snapped to whole / half hours), before the oven starts.
  setAlarmFrom(p) {
    if (this.phase !== 'idle' && this.phase !== 'ready') return;
    const dx = p.x - DIAL_X;
    const dy = p.y - DIAL_Y;
    if (Math.hypot(dx, dy) < 24) return; // too close to the centre to tell a direction
    const angle = (Math.atan2(dx, -dy) + TURN) % TURN;
    const a = angleToAlarm(angle, this.bt.halfHours);
    if (a === this.alarm) return;
    this.alarm = a;
    this.showAlarm();
    this.updateGo();
  }

  // N3: an alarm on the start time is not set yet.
  alarmSet() {
    return this.bt.kind !== 'clock' || clockHours(this.alarm) !== clockHours(this.bt.start);
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
    this.updateGo();
  }

  // ▶ once the heat is chosen (and at N3 the alarm set). N3: while the heat is chosen but the
  // alarm is not set, the bell and the alarm hand pulse (that is what ▶ waits for).
  updateGo() {
    if (this.phase === 'ready') this.setGoEnabled(this.alarmSet());
    this.pulseAlarm(this.phase === 'ready' && !this.alarmSet());
  }

  pulseAlarm(on) {
    if (!this.alarmIcon) return;
    if (on && !this.alarmPulse) {
      const k = this.alarmIcon.scaleX;
      this.alarmPulse = this.tweens.add({
        targets: this.alarmIcon, scale: { from: k, to: k * 1.2 }, duration: dur(450), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.alarmPulse.baseScale = k;
      this.alarmHandPulse = this.tweens.add({
        targets: this.alarmHand, alpha: { from: 1, to: 0.45 }, duration: dur(450), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else if (!on && this.alarmPulse) {
      this.alarmPulse.stop();
      this.alarmIcon.setScale(this.alarmPulse.baseScale);
      this.alarmPulse = null;
      this.alarmHandPulse?.stop();
      this.alarmHandPulse = null;
      this.alarmHand.setAlpha(1);
    }
  }

  setGoEnabled(on) {
    if (on) this.go.clearTint().setAlpha(1).setInteractive({ useHandCursor: true });
    else this.go.setTint(0x9e9e9e).setAlpha(0.6).disableInteractive();
  }

  onGo() {
    if (this.phase === 'ready' && this.alarmSet()) this.startBaking();
    else if (this.phase === 'baking' && this.time.now - this.startedAt >= TAKE_OUT_GUARD_MS) this.takeOut();
  }

  startBaking() {
    this.phase = 'baking';
    this.startedAt = this.time.now;
    if (this.bt.kind === 'sector') {
      this.timer = createBakeTimer(this.heat, this.target, { greenFactor: factors().greenWindow });
    } else {
      const stopAt = this.bt.kind === 'clock' ? alarmDelay(this.bt.start, this.alarm) : null;
      this.timer = createTimeTimer(this.bt, this.heat, { anim: factors().anim, stopAt });
    }
    this.alarmZone?.disableInteractive();
    this.pulseAlarm(false);
    this.dragging = false;
    this.heatBtns.forEach((b) => { b.zone.disableInteractive(); });
    this.heatBtns.forEach((b, i) => { if (i + 1 !== this.heat) b.box.setAlpha(0.45); });
    this.go.setTexture('icon-out');
    this.glowTween = this.tweens.add({ targets: this.glow, alpha: { from: 0.12, to: 0.38 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.heatEvent = this.time.addEvent({ delay: 650, loop: true, callback: () => heatRise(this, OVEN_X, WIN_Y + WIN_H - 20) });
  }

  // The cake's gauge now (N1: the timer's; N2/N3: what the time x heat gave, on the same scale).
  gauge() {
    return this.bt.kind === 'sector' ? this.timer.gauge() : timedGauge(this.timer.amount(), this.win, this.heat, this.target);
  }

  update(time, delta) {
    if (this.phase !== 'baking') return;
    this.timer.tick(delta); // clamped inside, so a hidden tab or sleep never burns the cake
    const g = this.gauge();
    this.cake.setBakeGauge(g);
    this.setRise(g);
    if (this.bt.kind === 'sector') this.hand.setRotation(g * TIMER_RUN * DEG);
    else if (this.bt.kind === 'number') this.hand.setRotation(this.timer.elapsed() * 60 * DEG);
    else {
      this.showClock(this.timer.elapsed());
      if (this.timer.done() && !this.rang) {
        if (this.timer.alarmReached) this.ring();
        else this.stopOven();
      }
    }
  }

  // N3: the oven stops (the alarm rang, or it ran its longest): the glow goes down and the mitt
  // calls her.
  stopOven() {
    this.rang = true;
    this.heatEvent?.remove();
    this.glowTween?.stop();
    this.tweens.add({ targets: this.glow, alpha: 0.06, duration: 300 });
    const b = this.go.scaleX;
    this.ringTween = this.tweens.add({ targets: this.go, scale: b * 1.1, duration: dur(400), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // N3: the hour hand reached the alarm: the oven stops and the alarm rings (pictures only, no
  // sound).
  ring() {
    this.stopOven();
    const k = this.alarmIcon.scaleX;
    this.tweens.add({ targets: this.alarmIcon, angle: { from: -14, to: 14 }, duration: 90, yoyo: true, repeat: 7, onComplete: () => this.alarmIcon.setAngle(0) });
    this.tweens.add({ targets: this.alarmIcon, scale: k * 1.25, duration: dur(300), yoyo: true });
    this.alarmHand.setTint(0xffcdd2);
    this.tweens.add({ targets: this.alarmHand, alpha: { from: 1, to: 0.4 }, duration: 180, yoyo: true, repeat: 3, onComplete: () => this.alarmHand.setAlpha(1).clearTint() });
  }

  takeOut() {
    this.phase = 'out';
    const g = this.gauge();
    this.finalGauge = g;
    this.finalState = this.bt.kind === 'sector' ? bakeState(g) : judgeTimed(this.timer.amount(), this.win, this.heat, this.target);
    this.ringTween?.stop();
    this.heatEvent?.remove();
    this.glowTween?.stop();
    this.tweens.add({ targets: this.glow, alpha: 0, duration: 300 });
    this.setGoEnabled(false);
    const state = this.finalState;
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
      this.tweens.add({ targets: part, y: part.y - lift, alpha: 0, duration: dur(650), ease: 'Back.easeIn' });
    }
    this.tweens.add({
      targets: plain, scaleX: plain.scaleX * 1.06, scaleY: plain.scaleY * 1.06, duration: dur(160), delay: dur(560), yoyo: true,
    });
    this.bar.setValidateEnabled(true);
  }

  validate() {
    if (this.phase !== 'out') return false;
    const state = this.finalState;
    // the heat she chose: the Service recap shows the flames when they were wrong
    this.round.results.cuisson = state === 'dore' ? { ok: true } : { ok: false, reason: state, heat: this.heat, wrongHeat: this.heat !== this.target };
    this.round.cake.bake = state;
    goNext(this);
  }
}
