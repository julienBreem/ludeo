// Service cash step (theme `monnaie`), after the ✅/❌ reveal and the bites, before the coins fly to
// her savings. The client lays the payment on the counter tray; she slides it into the till (a drag
// onto the till, or a tap: anywhere on the tray takes the nearest piece, so the whole tray is the
// target).
// - N1: coins of 1, one per point; then the total among 3 dice faces. Wrong: the coins come back
//   out of the till one by one and light up (recount together), the right face lights up.
// - N2: coins of 1 and 2 (sometimes a 5 note); the total among 3 numbers. Wrong: the same recount.
// - N3: a ticket shows the amount due (a number and coins of 1); the client pays with a 5 note; she
//   slides it into the till, then gives the change from the till's compartments (tap a compartment:
//   one piece to the tray; tap the tray: the nearest piece goes back) and validates with ✓. Wrong:
//   the client shows the difference in a bubble (+ / − and the coins), then the right change is
//   laid on the tray. The till holds the client's money and a float (FLOAT); RESERVE is added only
//   when the change cannot be made from it (not earnings).
// Feedback never blocks: after it the step ends by itself. onAnswer(ok) runs once, with the first
// answer; onDone() once at the end. info() gives the layout and state (smoke test).
import { W, OUTLINE, TOUCH } from '../config.js';
import { dur } from './pace.js';
import { popIn, sparkle } from './fx.js';
import { addIconButton } from './button.js';
import { payment, changeFor, totalOf, choices, RESERVE } from '../logic/money.js';
import { ensureMoneyTextures, TILL, TRAY_Y, TICKET_AREA, MONEY_FRAMES, moneyKey, isNote } from './moneyArt.js';

export const TRAY_POS = { x: 565, y: 570 };
export const TILL_POS = { x: 1020, y: 400, scale: 1.1 }; // compartments ~99 px wide at this scale
const TICKET_POS = { x: 650, y: 330, scale: 0.8, angle: 5 };
const BUBBLE_POS = { x: 300, y: 250 };
const CHOICE_Y = 718;
const CHOICE_PITCH = 160;
const CHOICE_SIZE = 124;
const OK_POS = { x: TRAY_POS.x, y: 718 };
export const FLOAT = [2, 2, 1, 1, 1]; // N3: what is in the till before the client pays
const TRAY_SCALE = { coin: 0.6, note: 0.62 };
const TRAY_PITCH = 100;
const TRAY_WIDTH = 360; // money line on the felt
const TAP_PX = 14;
const DEPTH = 60;
const GOOD = 0x66bb6a;
const SOFT_BAD = 0xffcdd2;
const GLOW = 0xffe066;
const FONT = 'Arial Black, Arial, sans-serif';

export class CashStep {
  constructor(scene, { level, score, client, rng = Math.random, onAnswer, onDone }) {
    ensureMoneyTextures(scene);
    this.scene = scene;
    this.level = Math.min(3, Math.max(1, level ?? 1));
    this.client = client;
    this.rng = rng;
    this.onAnswer = onAnswer;
    this.onDone = onDone;
    this.phase = 'intro';
    this.answered = false;
    this.firstOk = null;
    this.finished = false;
    this.tray = []; // {value, img}
    this.slots = { 1: [], 2: [], 5: [], 10: [] }; // till piles: {value, img, reserve}
    this.slid = []; // N1-N2: pieces in the order she slid them (the recount order)
    this.reserveUsed = false;
    this.pay = payment(score, this.level, rng);
    this.root = scene.add.container(0, 0).setDepth(DEPTH);
    this.handlers = [];

    this.trayImg = scene.add.image(TRAY_POS.x, TRAY_POS.y, 'counter-tray');
    this.tillImg = scene.add.image(TILL_POS.x, TILL_POS.y, 'till').setScale(TILL_POS.scale);
    this.root.add([this.tillImg, this.trayImg]);
    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: dur(300) });

    if (this.level >= 3) {
      this.due = this.pay.due;
      this.paid = this.pay.paid;
      this.need = this.paid - this.due;
      for (const v of FLOAT) this.addToSlot(v, false);
    } else {
      this.total = totalOf(this.pay.coins);
    }
    this.installInput();
    scene.events.once('shutdown', () => this.destroy());
    if (this.level >= 3) this.drawTicket();
    scene.time.delayedCall(dur(this.level >= 3 ? 700 : 300), () => this.layPayment());
  }

  // ---- geometry ---------------------------------------------------------------------------------

  tillPt(fx, fy) {
    const s = TILL_POS.scale;
    return { x: TILL_POS.x + (fx - MONEY_FRAMES.till.w / 2) * s, y: TILL_POS.y + (fy - MONEY_FRAMES.till.h / 2) * s };
  }

  slotPt(value, i) {
    const p = TILL.slots[value];
    return this.tillPt(p.x + i * TILL.pileDx, p.y + i * TILL.pileDy);
  }

  inTill(x, y) {
    const a = this.tillPt(0, 0);
    const b = this.tillPt(MONEY_FRAMES.till.w, MONEY_FRAMES.till.h);
    return x >= a.x && x <= b.x && y >= a.y && y <= b.y;
  }

  inTray(x, y) {
    const w = MONEY_FRAMES['counter-tray'].w;
    const h = MONEY_FRAMES['counter-tray'].h;
    return Math.abs(x - TRAY_POS.x) <= w / 2 && Math.abs(y - TRAY_POS.y) <= h / 2;
  }

  // The compartment under (x, y) at N3 (its drop zone, extended up over its pile), or null.
  slotAt(x, y) {
    for (const v of [1, 2, 5, 10]) {
      const p = TILL.slots[v];
      const a = this.tillPt(p.x - TILL.slotHalfW, TILL.slotTop - 40);
      const b = this.tillPt(p.x + TILL.slotHalfW, TILL.slotBottom + 20);
      if (x >= a.x && x <= b.x && y >= a.y && y <= b.y) return v;
    }
    return null;
  }

  trayLine() {
    return TRAY_POS.y + (TRAY_Y - MONEY_FRAMES['counter-tray'].h / 2);
  }

  trayPt(i, n) {
    const pitch = n > 1 ? Math.min(TRAY_PITCH, TRAY_WIDTH / (n - 1)) : 0;
    return { x: TRAY_POS.x + (i - (n - 1) / 2) * pitch, y: this.trayLine() };
  }

  piece(value, x, y) {
    const img = this.scene.add.image(x, y, moneyKey(value));
    this.root.add(img);
    return img;
  }

  traySize(img, value) {
    img.setScale(isNote(value) ? TRAY_SCALE.note : TRAY_SCALE.coin);
  }

  tillSize(img, value) {
    img.setScale((isNote(value) ? TILL.noteScale : TILL.coinScale) * TILL_POS.scale);
  }

  addToSlot(value, reserve) {
    const pile = this.slots[value];
    const p = this.slotPt(value, pile.length);
    const img = this.piece(value, p.x, p.y);
    this.tillSize(img, value);
    if (reserve) img.setTint(0xd6ecff);
    pile.push({ value, img, reserve });
  }

  // Tweens every tray piece to its place (n pieces evenly on the felt).
  layoutTray() {
    const n = this.tray.length;
    this.tray.forEach((it, i) => {
      const p = this.trayPt(i, n);
      this.scene.tweens.add({ targets: it.img, x: p.x, y: p.y, duration: dur(180), ease: 'Sine.easeOut' });
    });
  }

  // ---- 1. the client lays the money on the tray ------------------------------------------------

  drawTicket() {
    const s = this.scene;
    const c = s.add.container(TICKET_POS.x, TICKET_POS.y);
    const { w, h } = MONEY_FRAMES.ticket;
    c.add(s.add.image(0, 0, 'ticket'));
    const cx = (TICKET_AREA.x0 + TICKET_AREA.x1) / 2 - w / 2;
    const cy = (TICKET_AREA.y0 + TICKET_AREA.y1) / 2 - h / 2;
    c.add(s.add.text(cx, cy - 22, String(this.due), { fontFamily: FONT, fontSize: '92px', color: '#1f2a44' }).setOrigin(0.5));
    const pitch = 36;
    for (let i = 0; i < this.due; i++) {
      c.add(s.add.image(cx + (i - (this.due - 1) / 2) * pitch, cy + 54, 'coin-1').setScale(0.26));
    }
    c.setScale(TICKET_POS.scale).setAngle(TICKET_POS.angle);
    this.root.add(c);
    this.ticket = c;
    popIn(s, c);
  }

  layPayment() {
    if (this.finished) return;
    const coins = this.pay.coins;
    const n = coins.length;
    const from = { x: this.client.x + 80, y: this.client.y - 40 };
    let landed = 0;
    coins.forEach((value, i) => {
      this.scene.time.delayedCall(dur(i * 200), () => {
        if (this.finished) return;
        const img = this.piece(value, from.x, from.y);
        this.traySize(img, value);
        const item = { value, img };
        this.tray.push(item);
        const p = this.trayPt(i, n);
        this.scene.tweens.add({
          targets: img, x: p.x, y: p.y, duration: dur(320), ease: 'Sine.easeOut',
          onComplete: () => { if (++landed === n) this.phase = 'slide'; },
        });
      });
    });
  }

  // ---- input: the tray (drag or tap), the till's compartments (N3) ------------------------------

  installInput() {
    const s = this.scene;
    const { w, h } = MONEY_FRAMES['counter-tray'];
    this.trayZone = s.add.zone(TRAY_POS.x, TRAY_POS.y, w, h).setInteractive({ useHandCursor: true });
    this.root.add(this.trayZone);
    this.trayZone.on('pointerdown', p => this.trayDown(p));
    const a = this.tillPt(TILL.drawer.x0, TILL.slotTop - 40);
    const b = this.tillPt(TILL.drawer.x1, TILL.drawer.y1);
    this.tillZone = s.add.zone((a.x + b.x) / 2, (a.y + b.y) / 2, b.x - a.x, b.y - a.y).setInteractive({ useHandCursor: true });
    this.root.add(this.tillZone);
    this.tillZone.on('pointerup', p => this.tillTap(p));
    const move = p => this.dragMove(p);
    const up = p => this.dragUp(p);
    s.input.on('pointermove', move);
    s.input.on('pointerup', up);
    this.handlers.push(['pointermove', move], ['pointerup', up]);
  }

  nearestTray(x) {
    let best = null;
    for (const it of this.tray) if (!best || Math.abs(it.img.x - x) < Math.abs(best.img.x - x)) best = it;
    return best;
  }

  trayDown(p) {
    if (this.drag || !this.tray.length) return;
    if (this.phase === 'slide') {
      const it = this.nearestTray(p.x);
      this.drag = { it, x0: p.x, y0: p.y, dx: it.img.x - p.x, dy: it.img.y - p.y, moved: false };
      it.img.setDepth(1);
      this.root.bringToTop(it.img);
    } else if (this.phase === 'change') {
      this.drag = { back: true, x0: p.x, y0: p.y };
    }
  }

  dragMove(p) {
    const d = this.drag;
    if (!d || d.back || !p.isDown) return;
    if (Math.hypot(p.x - d.x0, p.y - d.y0) > TAP_PX) d.moved = true;
    if (d.moved) d.it.img.setPosition(p.x + d.dx, p.y + d.dy);
  }

  dragUp(p) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.back) {
      // N3: a tap on the tray gives the nearest piece back to its compartment
      if (this.phase === 'change' && this.inTray(p.x, p.y)) this.giveBack(this.nearestTray(p.x));
      return;
    }
    const tapped = !d.moved;
    if (this.phase === 'slide' && (tapped || this.inTill(p.x, p.y))) {
      this.slideIn(d.it);
    } else {
      this.layoutTray();
    }
  }

  tillTap(p) {
    if (this.phase !== 'change' || this.drag) return;
    const v = this.slotAt(p.x, p.y);
    if (v !== null) this.take(v);
  }

  // A tray piece goes into its compartment of the till.
  slideIn(it) {
    const i = this.tray.indexOf(it);
    if (i < 0) return;
    this.tray.splice(i, 1);
    const pile = this.slots[it.value];
    const pt = this.slotPt(it.value, pile.length);
    pile.push({ value: it.value, img: it.img, reserve: false });
    this.slid.push(it);
    const k = (isNote(it.value) ? TILL.noteScale : TILL.coinScale) * TILL_POS.scale;
    this.scene.tweens.add({ targets: it.img, x: pt.x, y: pt.y, scale: k, duration: dur(260), ease: 'Sine.easeIn' });
    this.layoutTray();
    if (!this.tray.length) {
      this.phase = 'wait';
      this.scene.time.delayedCall(dur(400), () => (this.level >= 3 ? this.startChange() : this.showChoices()));
    }
  }

  // ---- 2a. N1-N2: the total among 3 -------------------------------------------------------------

  showChoices() {
    if (this.finished) return;
    const s = this.scene;
    const values = choices(this.total, this.level, this.rng);
    this.choiceBtns = values.map((value, i) => {
      const x = TRAY_POS.x + (i - 1) * CHOICE_PITCH;
      const c = s.add.container(x, CHOICE_Y);
      const bg = s.add.graphics();
      this.paintButton(bg, 0xffffff);
      c.add(bg);
      c.add(this.level === 1 ? this.dice(value) : s.add.text(0, 2, String(value), { fontFamily: FONT, fontSize: '68px', color: '#1f2a44' }).setOrigin(0.5));
      const zone = s.add.zone(0, 0, CHOICE_SIZE, CHOICE_SIZE).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.choose(btn));
      c.add(zone);
      this.root.add(c);
      popIn(s, c);
      const btn = { value, c, bg, zone };
      return btn;
    });
    this.phase = 'choose';
  }

  paintButton(bg, fill, line = OUTLINE) {
    const r = CHOICE_SIZE / 2;
    bg.clear();
    bg.fillStyle(0x000000, 0.15).fillRoundedRect(-r + 3, -r + 6, CHOICE_SIZE, CHOICE_SIZE, 24);
    bg.fillStyle(fill, 1).fillRoundedRect(-r, -r, CHOICE_SIZE, CHOICE_SIZE, 24);
    bg.lineStyle(5, line, 1).strokeRoundedRect(-r, -r, CHOICE_SIZE, CHOICE_SIZE, 24);
  }

  // A die face for n (1..5); 0 = an empty face; above 5 = a 5 and the rest, side by side.
  dice(n) {
    const s = this.scene;
    const c = s.add.container(0, 0);
    const face = (k, x, size) => {
      if (k >= 1 && k <= 5) return c.add(s.add.image(x, 0, `dice-${k}`).setDisplaySize(size, size));
      const g = s.add.graphics();
      g.fillStyle(0xffffff, 1).fillRoundedRect(x - size / 2, -size / 2, size, size, size * 0.2);
      g.lineStyle(4, 0x7a8aa0, 1).strokeRoundedRect(x - size / 2, -size / 2, size, size, size * 0.2);
      return c.add(g);
    };
    if (n <= 5) face(n, 0, 96);
    else { face(5, -27, 52); face(n - 5, 27, 52); }
    return c;
  }

  choose(btn) {
    if (this.phase !== 'choose') return;
    this.phase = 'feedback';
    for (const b of this.choiceBtns) b.zone.disableInteractive();
    const ok = btn.value === this.total;
    this.answer(ok);
    if (ok) {
      this.paintButton(btn.bg, 0xc8f2c2, 0x2e7d32);
      this.happy(btn.c.x, btn.c.y);
      this.scene.time.delayedCall(dur(900), () => this.finish());
      return;
    }
    this.paintButton(btn.bg, SOFT_BAD, 0xc62828);
    this.scene.time.delayedCall(dur(500), () => this.recount());
  }

  // Wrong total: the pieces come back out of the till onto the tray one by one, each lighting up;
  // then the right answer lights up; then they go back into the till and the step ends.
  recount() {
    if (this.finished) return;
    const s = this.scene;
    const items = this.slid;
    const n = items.length;
    this.phase = 'recount';
    this.glows = [];
    items.forEach((it, i) => {
      s.time.delayedCall(dur(i * 550), () => {
        if (this.finished) return;
        const p = this.trayPt(i, n);
        const glow = s.add.graphics();
        glow.fillStyle(GLOW, 0.9).fillCircle(0, 0, isNote(it.value) ? 70 : 54);
        glow.setPosition(p.x, p.y).setScale(0);
        this.root.add(glow);
        this.root.bringToTop(it.img);
        this.glows.push(glow);
        s.tweens.add({ targets: glow, scale: 1, duration: dur(200), ease: 'Back.easeOut' });
        this.traySize(it.img, it.value);
        const k = it.img.scale;
        it.img.setScale(TILL.coinScale * TILL_POS.scale);
        s.tweens.add({ targets: it.img, x: p.x, y: p.y, scale: k, duration: dur(300), ease: 'Sine.easeOut' });
      });
    });
    s.time.delayedCall(dur(n * 550 + 300), () => {
      if (this.finished) return;
      const right = this.choiceBtns.find(b => b.value === this.total);
      if (right) {
        this.paintButton(right.bg, 0xc8f2c2, 0x2e7d32);
        s.tweens.add({ targets: right.c, scale: 1.12, duration: dur(260), yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      }
      s.time.delayedCall(dur(1600), () => {
        if (this.finished) return;
        for (const g of this.glows) g.destroy();
        this.glows = [];
        // back into the till, where they were
        for (const [v, pile] of Object.entries(this.slots)) {
          pile.forEach((it, i) => {
            const pt = this.slotPt(Number(v), i);
            const k = (isNote(it.value) ? TILL.noteScale : TILL.coinScale) * TILL_POS.scale;
            s.tweens.add({ targets: it.img, x: pt.x, y: pt.y, scale: k, duration: dur(300), ease: 'Sine.easeIn' });
          });
        }
        s.time.delayedCall(dur(500), () => this.finish());
      });
    });
  }

  // ---- 2b. N3: give the change ----------------------------------------------------------------

  tillValues() {
    return Object.values(this.slots).flat().map(it => it.value);
  }

  startChange() {
    if (this.finished) return;
    if (!changeFor(this.due, this.paid, this.tillValues())) {
      this.reserveUsed = true;
      for (const v of RESERVE) this.addToSlot(v, true);
    }
    this.change = [];
    this.okBtn = addIconButton(this.scene, OK_POS.x, OK_POS.y, 'icon-ok', () => this.validate(), { size: TOUCH });
    this.root.add(this.okBtn);
    popIn(this.scene, this.okBtn);
    this.phase = 'change';
  }

  // One piece of that compartment onto the tray.
  take(value) {
    const pile = this.slots[value];
    if (!pile.length) return;
    const it = pile.pop();
    this.tray.push(it);
    this.root.bringToTop(it.img);
    this.scene.tweens.add({ targets: it.img, scale: isNote(value) ? TRAY_SCALE.note : TRAY_SCALE.coin, duration: dur(180) });
    this.layoutTray();
  }

  giveBack(it) {
    if (!it) return;
    this.tray.splice(this.tray.indexOf(it), 1);
    const pile = this.slots[it.value];
    const pt = this.slotPt(it.value, pile.length);
    pile.push(it);
    const k = (isNote(it.value) ? TILL.noteScale : TILL.coinScale) * TILL_POS.scale;
    this.scene.tweens.add({ targets: it.img, x: pt.x, y: pt.y, scale: k, duration: dur(220), ease: 'Sine.easeIn' });
    this.layoutTray();
  }

  validate() {
    if (this.phase !== 'change') return;
    this.phase = 'feedback';
    this.okBtn.disableInteractive();
    const given = totalOf(this.tray.map(it => it.value));
    const ok = given === this.need;
    this.answer(ok);
    if (ok) {
      this.happy(TRAY_POS.x, this.trayLine());
      this.scene.time.delayedCall(dur(500), () => this.handOver());
      return;
    }
    this.showDifference(this.need - given);
  }

  // Wrong change: the client shows the difference (+ more needed / − too much, with the coins),
  // then her pieces go back and the right change is laid on the tray.
  showDifference(diff) {
    const s = this.scene;
    this.phase = 'difference';
    const c = s.add.container(BUBBLE_POS.x, BUBBLE_POS.y);
    const coins = [];
    for (let left = Math.abs(diff); left > 0;) {
      const v = left >= 5 ? 5 : left >= 2 ? 2 : 1;
      coins.push(v);
      left -= v;
    }
    const pitch = 62;
    const w = 90 + coins.reduce((a, v) => a + (isNote(v) ? 96 : pitch), 0) + 70;
    const h = 112;
    const g = s.add.graphics();
    g.fillStyle(0x000000, 0.12).fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 28);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
    g.fillTriangle(-20, h / 2 - 2, 20, h / 2 - 2, 0, h / 2 + 26);
    g.lineStyle(5, OUTLINE, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
    c.add(g);
    // the sign: + (she owes more) green, − (too much) red
    const b = s.add.graphics();
    const bx = -w / 2 + 48;
    b.fillStyle(diff > 0 ? 0x43a047 : 0xe53935, 1).fillCircle(bx, 0, 28);
    b.lineStyle(4, OUTLINE, 1).strokeCircle(bx, 0, 28);
    b.fillStyle(0xffffff, 1).fillRect(bx - 15, -4, 30, 8);
    if (diff > 0) b.fillRect(bx - 4, -15, 8, 30);
    c.add(b);
    let x = bx + 46;
    for (const v of coins) {
      const step = isNote(v) ? 96 : pitch;
      const img = s.add.image(x + step / 2 - 6, 0, moneyKey(v)).setScale(isNote(v) ? 0.38 : 0.4);
      c.add(img);
      x += step;
    }
    c.add(s.add.text(x + 24, 2, String(Math.abs(diff)), { fontFamily: FONT, fontSize: '48px', color: '#1f2a44' }).setOrigin(0.5));
    this.root.add(c);
    this.bubble = c;
    popIn(s, c);
    s.time.delayedCall(dur(2200), () => this.correctChange());
  }

  correctChange() {
    if (this.finished) return;
    const s = this.scene;
    for (const it of [...this.tray]) this.giveBack(it);
    s.time.delayedCall(dur(400), () => {
      if (this.finished) return;
      let right = changeFor(this.due, this.paid, this.tillValues());
      if (!right) {
        this.reserveUsed = true;
        for (const v of RESERVE) this.addToSlot(v, true);
        right = changeFor(this.due, this.paid, this.tillValues()) ?? [];
      }
      for (const v of right) this.take(v);
      s.time.delayedCall(dur(250), () => {
        this.glows = this.tray.map((it, i) => {
          const p = this.trayPt(i, this.tray.length);
          const glow = s.add.graphics();
          glow.lineStyle(7, GOOD, 1).strokeCircle(0, 0, 52);
          glow.setPosition(p.x, p.y);
          this.root.add(glow);
          return glow;
        });
      });
      s.time.delayedCall(dur(1700), () => {
        for (const g of this.glows ?? []) g.destroy();
        this.glows = [];
        if (this.bubble) s.tweens.add({ targets: this.bubble, alpha: 0, duration: dur(250) });
        this.handOver();
      });
    });
  }

  // The change on the tray goes to the client.
  handOver() {
    if (this.finished) return;
    const s = this.scene;
    const items = [...this.tray];
    this.tray = [];
    for (const it of items) {
      s.tweens.add({
        targets: it.img, x: this.client.x + 60, y: this.client.y - 40, scale: 0.3, alpha: 0, duration: dur(450), ease: 'Sine.easeIn',
      });
    }
    s.time.delayedCall(dur(items.length ? 700 : 300), () => this.finish());
  }

  // ---- end ------------------------------------------------------------------------------------

  answer(ok) {
    if (this.answered) return;
    this.answered = true;
    this.firstOk = ok;
    this.onAnswer?.(ok);
  }

  happy(x, y) {
    this.client.setMood?.('content');
    sparkle(this.scene, x, y);
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'done';
    this.okBtn?.disableInteractive();
    this.onDone?.();
  }

  // The till's centre: where the earned coins leave from.
  tillCenter() {
    return this.tillPt(210, 290);
  }

  fadeOut(done) {
    this.scene.tweens.add({
      targets: this.root, alpha: 0, duration: dur(350),
      onComplete: () => { this.destroy(); done?.(); },
    });
  }

  destroy() {
    for (const [ev, fn] of this.handlers) this.scene.input?.off(ev, fn);
    this.handlers = [];
    if (this.root?.active) this.root.destroy();
  }

  // Layout and state for the smoke test (screen px).
  info() {
    const pt = o => [Math.round(o.x), Math.round(o.y)];
    const slots = {};
    for (const [v, pile] of Object.entries(this.slots)) {
      const p = TILL.slots[v];
      slots[v] = { at: pt(this.tillPt(p.x, p.y - 10)), count: pile.length };
    }
    return {
      level: this.level,
      phase: this.phase,
      total: this.total ?? null,
      due: this.due ?? null,
      paid: this.paid ?? null,
      need: this.need ?? null,
      firstOk: this.firstOk,
      reserveUsed: this.reserveUsed,
      tray: this.tray.map(it => ({ value: it.value, at: pt(it.img) })),
      trayAt: [TRAY_POS.x, TRAY_POS.y],
      tillAt: pt(this.tillPt(210, 300)),
      slots,
      choices: (this.choiceBtns ?? []).map(b => ({ value: b.value, at: [b.c.x, b.c.y] })),
      ok: this.okBtn ? [this.okBtn.x, this.okBtn.y] : null,
      width: W,
    };
  }
}
