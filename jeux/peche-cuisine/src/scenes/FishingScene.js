// Fishing at level 1 with the bamboo rod. Tap a fish: the line and bobber drop on it and it
// stops. After a short wait the bobber dips (bite); a tap anywhere during the bite hooks it.
// A missed bite costs nothing: the fish swims on. A listed fish flies to its slot; an off-list
// one is shown next to the list with a red cross, then released with a splash.
import { W, H, TOUCH, BG } from '../config.js';
import { addIconButton } from '../ui/button.js';
import { goTo } from '../ui/flow.js';
import { dur } from '../ui/pace.js';
import { popIn, sparkle, splash } from '../ui/fx.js';
import { drawFish } from '../ui/fishArt.js';
import { newRound, getState } from '../game-state.js';
import { gameSetup } from '../logic/setup.js';
import { matchSlot, spawnCatch } from '../logic/fishing.js';

const HOME_URL = '../../index.html';

const PANEL = { left: 716, top: 16, w: 548, h: 120 };
const CARD = { w: 124, h: 100, gap: 10, y: 76, firstX: 789 };
const CARD_FISH_SCALE = 0.4; // list fish are drawn smaller than in the pond, sizes stay distinct
// Inner water of pond-bg.svg (ellipse 640,440 r 500x250, grass from y 700). Fish stay inside a
// smaller ellipse so their whole body is on the water, never on the rim or the grass.
const POND = { cx: 640, cy: 430, rx: 400, ry: 170 };
const MIN_HIT = 100; // px on screen, above the 96 px minimum
const SWIM_SPEED = 0.05; // px per (paced) ms: slow
const MIN_LEG = 160; // px: a fish swims at least this far before turning
const DIVE_RATE = 0.2; // after each leg, chance a fish dives away and a new one comes up
const MISSING_RATE = 0.8; // chance a new fish is a listed one the pond lacks

// A random point inside the pond's swimming area.
function pondPoint() {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random());
  return { x: POND.cx + Math.cos(a) * r * POND.rx, y: POND.cy + Math.sin(a) * r * POND.ry };
}
const ROD_TIP = { x: 270, y: 530 };
const SHOW_POS = { x: 500, y: 90 }; // where an off-list fish is shown, left of the list
const D = { fish: 10, line: 40, rod: 50, panel: 100, flying: 300, ok: 400, home: 500 };
// Smaller fish swim above bigger ones, so a big fish never hides (or steals the tap of) a small one.
const SIZE_DEPTH = { petit: 2, moyen: 1, grand: 0 };

export class FishingScene extends Phaser.Scene {
  constructor() {
    super('Fishing');
  }

  create() {
    // Phaser reuses the instance: every per-run field is reset here.
    this.round = newRound();
    this.colors = gameSetup(getState()).colors;
    this.pondSize = gameSetup(getState()).pondSize;
    this.fishes = [];
    this.cards = [];
    this.phase = 'idle'; // idle | waiting | bite | busy | done
    this.target = null;
    this.lineOn = false;
    this.okButton = null;
    this.timers = [];
    this.__leaving = null;

    this.cameras.main.setBackgroundColor(BG);
    this.add.image(W / 2, H / 2, 'pond-bg').setDepth(0);

    this.buildRod();
    this.buildPanel();
    for (let i = 0; i < this.pondSize; i++) this.spawnFish(true);

    addIconButton(this, 24 + TOUCH / 2, 24 + TOUCH / 2, 'icon-home', () => this.goHome()).setDepth(D.home);

    this.input.on('pointerdown', () => { if (this.phase === 'bite') this.hook(); });
  }

  // ---- layout ----

  buildRod() {
    this.add.image(170, 650, 'rod-bambou').setScale(2).setDepth(D.rod);
    this.line = this.add.graphics().setDepth(D.line);
    this.bobber = this.add.image(ROD_TIP.x, ROD_TIP.y, 'bobber').setScale(0.6).setDepth(D.line + 1).setVisible(false);
  }

  buildPanel() {
    const g = this.add.graphics().setDepth(D.panel);
    g.fillStyle(0xffffff, 0.85).fillRoundedRect(PANEL.left, PANEL.top, PANEL.w, PANEL.h, 20);
    this.round.list.forEach((slot, i) => {
      const x = this.slotX(i);
      g.fillStyle(0xe3f2fd, 1).fillRoundedRect(x - CARD.w / 2, CARD.y - CARD.h / 2, CARD.w, CARD.h, 14);
      const fish = drawFish(this, x, CARD.y, slot).setDepth(D.panel + 1);
      fish.setScale(fish.scaleX * CARD_FISH_SCALE).setAlpha(this.round.filled[i] ? 1 : 0.5);
      const check = this.add.image(x + 42, CARD.y + 32, 'icon-ok').setDisplaySize(44, 44)
        .setDepth(D.panel + 2).setVisible(!!this.round.filled[i]);
      this.cards.push({ fish, check });
    });
  }

  slotX(i) {
    return CARD.firstX + i * (CARD.w + CARD.gap);
  }

  // ---- pond fish ----

  spawnFish(initial = false) {
    const info = this.nextCatch();
    const { x, y } = pondPoint();
    const c = drawFish(this, x, y, info).setDepth(D.fish + SIZE_DEPTH[info.size]).setAlpha(initial ? 1 : 0);
    if (!initial) this.tweens.add({ targets: c, alpha: 1, duration: dur(500) });
    const base = c.scaleX;
    // Pad the touch area so even a small fish is at least MIN_HIT px on screen.
    c.setSize(Math.max(240, MIN_HIT / base), Math.max(140, MIN_HIT / base));
    c.setInteractive({ useHandCursor: true });
    const rec = { c, info, dir: 1, base, tween: null };
    c.on('pointerdown', () => this.onFishTap(rec));
    this.fishes.push(rec);
    this.startSwim(rec);
    return rec;
  }

  // Fish fill the list slots that no pond fish matches yet, most of the time: since fish stay
  // in the pond, a listed fish would otherwise be able to stay away for good.
  nextCatch() {
    const { list, filled } = this.round;
    const missing = list.filter((c, i) => !filled[i]
      && !this.fishes.some((f) => f.info.color === c.color && f.info.size === c.size));
    if (missing.length > 0 && Math.random() < MISSING_RATE) {
      const c = missing[Math.floor(Math.random() * missing.length)];
      return { color: c.color, size: c.size };
    }
    return spawnCatch(list, filled, this.colors, Math.random);
  }

  // The fish dives away (fades out) and a new one comes up elsewhere.
  dive(rec) {
    this.fishes = this.fishes.filter((f) => f !== rec);
    rec.c.disableInteractive();
    this.tweens.add({ targets: rec.c, alpha: 0, duration: dur(500), onComplete: () => rec.c.destroy() });
    this.spawnFish();
  }

  face(rec) {
    rec.c.list.forEach((part) => { part.scaleX = rec.dir; });
  }

  startSwim(rec) {
    this.stopSwim(rec);
    const c = rec.c;
    // Wander from point to point inside the pond, facing the way it swims.
    let p = pondPoint();
    for (let i = 0; i < 8 && Math.hypot(p.x - c.x, p.y - c.y) < MIN_LEG; i++) p = pondPoint();
    rec.dir = p.x >= c.x ? 1 : -1;
    this.face(rec);
    const dist = Math.hypot(p.x - c.x, p.y - c.y);
    rec.tween = this.tweens.add({
      targets: c, x: p.x, y: p.y, duration: dur(dist / SWIM_SPEED), ease: 'Sine.easeInOut',
      onComplete: () => {
        rec.tween = null;
        if (!c.active) return;
        if (this.phase !== 'done' && Math.random() < DIVE_RATE) this.dive(rec);
        else this.startSwim(rec);
      },
    });
  }

  stopSwim(rec) {
    if (rec.tween) { rec.tween.remove(); rec.tween = null; }
  }

  // ---- bamboo rod ----

  onFishTap(rec) {
    if (this.phase !== 'idle' || !this.fishes.includes(rec)) return;
    this.phase = 'waiting';
    this.target = rec;
    this.stopSwim(rec);
    this.bobber.setPosition(ROD_TIP.x, ROD_TIP.y).setVisible(true);
    this.lineOn = true;
    this.tweens.add({
      targets: this.bobber, x: rec.c.x, y: rec.c.y - 20, duration: dur(400), ease: 'Quad.easeOut',
      onComplete: () => {
        this.timers.push(this.time.delayedCall(dur(600 + Math.random() * 600), () => this.startBite()));
      },
    });
  }

  startBite() {
    if (this.phase !== 'waiting') return;
    this.phase = 'bite';
    const y = this.bobber.y;
    this.dip = this.tweens.add({
      targets: this.bobber, y: y + 22, duration: dur(250), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.biteTimer = this.time.delayedCall(dur(1800), () => this.missBite());
  }

  stopBite() {
    if (this.dip) { this.dip.remove(); this.dip = null; }
    if (this.biteTimer) { this.biteTimer.remove(); this.biteTimer = null; }
  }

  // The bite window ran out: the line comes back and the fish swims on, no penalty.
  missBite() {
    if (this.phase !== 'bite') return;
    this.stopBite();
    this.phase = 'busy';
    const rec = this.target;
    this.target = null;
    this.reelBack(() => {
      this.phase = 'idle';
    });
    if (rec && rec.c.active) this.startSwim(rec);
  }

  reelBack(done) {
    this.tweens.add({
      targets: this.bobber, x: ROD_TIP.x, y: ROD_TIP.y, duration: dur(350), ease: 'Quad.easeIn',
      onComplete: () => {
        this.bobber.setVisible(false);
        this.lineOn = false;
        this.line.clear();
        if (done) done();
      },
    });
  }

  hook() {
    if (this.phase !== 'bite') return;
    this.stopBite();
    this.phase = 'busy';
    const rec = this.target;
    this.target = null;
    this.reelBack();
    const slot = matchSlot(this.round.list, this.round.filled, rec.info);
    if (slot >= 0) this.flyToSlot(rec, slot);
    else this.showAndRelease(rec);
  }

  flyToSlot(rec, slot) {
    const round = this.round;
    round.filled[slot] = true;
    round.caught[slot] = { color: rec.info.color, size: rec.info.size };
    this.fishes = this.fishes.filter((f) => f !== rec);
    this.spawnFish();
    const c = rec.c;
    c.disableInteractive();
    c.setDepth(D.flying);
    const card = this.cards[slot];
    this.tweens.add({
      targets: c, x: this.slotX(slot), y: CARD.y, scaleX: card.fish.scaleX, scaleY: card.fish.scaleY,
      duration: dur(700), ease: 'Cubic.easeInOut',
      onComplete: () => {
        c.destroy();
        card.fish.setAlpha(1);
        card.check.setVisible(true);
        popIn(this, card.check);
        sparkle(this, this.slotX(slot), CARD.y);
        if (round.filled.every(Boolean)) this.finish();
        else this.phase = 'idle';
      },
    });
  }

  // Off-list catch: shown next to the list with a red cross, then back in the water.
  showAndRelease(rec) {
    this.round.results.peche = false;
    const c = rec.c;
    this.stopSwim(rec);
    c.disableInteractive();
    c.setDepth(D.flying);
    this.tweens.add({
      targets: c, x: SHOW_POS.x, y: SHOW_POS.y, scaleX: rec.base * 0.7, scaleY: rec.base * 0.7,
      duration: dur(500), ease: 'Cubic.easeOut',
      onComplete: () => {
        if (!c.active) return;
        c.list.forEach((part) => { part.scaleX = 1; });
        const cross = this.drawCross(SHOW_POS.x + 70, SHOW_POS.y - 10);
        this.timers.push(this.time.delayedCall(dur(1400), () => {
          cross.destroy();
          this.release(rec);
        }));
      },
    });
  }

  drawCross(x, y) {
    const g = this.add.graphics({ x, y }).setDepth(D.flying + 1);
    const r = 24;
    for (const [w, col] of [[18, 0xffffff], [10, 0xe53935]]) {
      g.lineStyle(w, col, 1).lineBetween(-r, -r, r, r).lineBetween(-r, r, r, -r);
    }
    return g;
  }

  // The wrong catch jumps back into the water with a splash.
  release(rec) {
    const c = rec.c;
    if (!c.active) return;
    const { x, y } = pondPoint();
    this.tweens.add({
      targets: c, x, y, scaleX: rec.base, scaleY: rec.base, duration: dur(600), ease: 'Sine.easeInOut',
      onComplete: () => {
        c.setDepth(D.fish + SIZE_DEPTH[rec.info.size]).setInteractive({ useHandCursor: true });
        splash(this, x, y, 0xffffff);
        const ring = this.add.image(x, y, 'splash-ring').setDepth(D.fish + 1).setScale(0.4).setAlpha(0.9);
        this.tweens.add({ targets: ring, scale: 1.1, alpha: 0, duration: dur(600), onComplete: () => ring.destroy() });
        this.startSwim(rec);
        this.phase = 'idle';
      },
    });
  }

  // ---- end ----

  finish() {
    this.phase = 'done';
    this.okButton = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => goTo(this, 'Weigh'))
      .setDepth(D.ok);
    popIn(this, this.okButton);
  }

  update() {
    if (!this.lineOn) return;
    this.line.clear().lineStyle(3, 0xffffff, 0.9).lineBetween(ROD_TIP.x, ROD_TIP.y, this.bobber.x, this.bobber.y - 30);
  }

  // Fades out, then opens the collection home (the game is two levels below it).
  goHome() {
    if (this.__leaving) return;
    this.__leaving = {};
    this.cameras.main.once('camerafadeoutcomplete', () => { window.location.href = HOME_URL; });
    this.cameras.main.fadeOut(250);
  }
}
