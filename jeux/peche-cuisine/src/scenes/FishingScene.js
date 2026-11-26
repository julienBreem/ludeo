// Fishing with the bamboo rod: tap the water to cast; a fish near the bobber swims up, nibbles
// (the bobber trembles), then bites (it sinks): tap to strike. Then the fight: finger down reels
// the fish in, but when it thrashes she must let go; holding through a thrash turns the line
// orange then red, then snaps it and the fish gets away (no penalty, she casts again). All the
// timing lives in logic/angling.js; this scene only casts, moves and draws. A landed listed fish
// flies to its slot; an off-list one is shown with a red cross, then released.
import { W, H, TOUCH, BG } from '../config.js';
import { addIconButton } from '../ui/button.js';
import { goTo } from '../ui/flow.js';
import { dur, factors } from '../ui/pace.js';
import { popIn, sparkle, splash } from '../ui/fx.js';
import { drawFish } from '../ui/fishArt.js';
import { newRound, getState } from '../game-state.js';
import { gameSetup } from '../logic/setup.js';
import { matchSlot, spawnCatch } from '../logic/fishing.js';
import { createAngling, pickFish, approach, strike, step, tension01 } from '../logic/angling.js';

const HOME_URL = '../../index.html';

const PANEL = { left: 716, top: 16, w: 548, h: 120 };
const CARD = { w: 124, h: 100, gap: 10, y: 76, firstX: 789 };
const CARD_FISH_SCALE = 0.4; // list fish are drawn smaller than in the pond, sizes stay distinct
// Inner water of pond-bg.svg (ellipse 640,440 r 500x250, grass from y 700). Fish stay inside a
// smaller ellipse so their whole body is on the water, never on the rim or the grass.
const POND = { cx: 640, cy: 430, rx: 400, ry: 170 };
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
// Water the bobber may land in: the inner pond ellipse, above the grass.
const WATER = { cx: 640, cy: 440, rx: 500, ry: 250, bottom: 690 };
// The rod turns about its butt; ROD_VEC is butt → tip at rest (rod-bambou.svg × 2).
const ROD_BUTT = { x: 50, y: 782 };
const ROD_VEC = { x: 220, y: -252 };
const ROD_BEND = 25; // degrees at full tension
const SHORE = { x: 380, y: 600 }; // where a reeled-in fish arrives, under the rod tip
const LINE_COLORS = [0xffffff, 0xff9800, 0xe53935]; // tension 0, 0.5, 1
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
    this.phase = 'idle'; // idle | casting | angling | busy | done
    this.angling = null; // logic/angling.js state of the current cast
    this.angled = null; // the pond fish on (or coming to) the line
    this.hookFrom = null; // where the fish was hooked; it is reeled from there to SHORE
    this.holding = false;
    this.wiggle = null;
    this.nextId = 0;
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

    // A pointer that starts on a button (home, ✓) is that button's, never a cast or a pull.
    this.input.on('pointerdown', (pointer, over) => { if (over.length === 0) this.onPointerDown(pointer); });
    const letGo = () => { this.holding = false; };
    this.input.on('pointerup', letGo);
    this.input.on('pointerupoutside', letGo);
    this.game.events.on('blur', letGo);
    this.events.once('shutdown', () => this.game.events.off('blur', letGo));
  }

  // ---- layout ----

  buildRod() {
    // Origin at the butt (20,146 in the 160 px art) so the rod bends by turning about it.
    this.rod = this.add.image(ROD_BUTT.x, ROD_BUTT.y, 'rod-bambou').setOrigin(20 / 160, 146 / 160)
      .setScale(2).setDepth(D.rod);
    this.line = this.add.graphics().setDepth(D.line);
    this.bobber = this.add.image(0, 0, 'bobber').setScale(0.6).setDepth(D.line + 1).setVisible(false);
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
    // Not interactive: a tap near a fish casts there (the bobber attracts it).
    const rec = { id: this.nextId++, c, info, dir: 1, base: c.scaleX, tween: null };
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

  // The art faces left: a fish heading right (dir 1) is mirrored.
  face(rec) {
    rec.c.list.forEach((part) => { part.scaleX = -rec.dir; });
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
        if (rec === this.angled) return; // on the line: never dives away
        if (this.phase !== 'done' && Math.random() < DIVE_RATE) this.dive(rec);
        else this.startSwim(rec);
      },
    });
  }

  stopSwim(rec) {
    if (rec.tween) { rec.tween.remove(); rec.tween = null; }
  }

  // ---- cast, bite and fight (timing: logic/angling.js) ----

  inWater(x, y) {
    const dx = (x - WATER.cx) / WATER.rx;
    const dy = (y - WATER.cy) / WATER.ry;
    return dx * dx + dy * dy <= 1 && y <= WATER.bottom;
  }

  onPointerDown(pointer) {
    const a = this.angling;
    if (this.phase === 'idle') {
      if (this.inWater(pointer.x, pointer.y)) this.cast(pointer.x, pointer.y);
      return;
    }
    if (this.phase !== 'angling' || !a) return;
    if (a.phase === 'fight') { this.holding = true; return; }
    if (a.phase === 'waiting') {
      // No fish came yet: casting elsewhere is allowed.
      if (this.inWater(pointer.x, pointer.y)) this.reelBack(() => this.cast(pointer.x, pointer.y), true);
      return;
    }
    this.angling = strike(a); // hooks at the bite, scares the fish before it
    if (this.angling.phase === 'fight') {
      this.onHooked();
      this.holding = true; // the striking finger stays down: it already reels (first thrash is ≥ 0.6 s away)
    }
    else this.onAnglingEvent(this.angling.result);
  }

  cast(x, y) {
    this.phase = 'casting';
    const tip = this.rodTip();
    this.bobber.setPosition(tip.x, tip.y).setAlpha(1).setVisible(true);
    this.lineOn = true;
    this.tweens.add({
      targets: this.bobber, x, y, duration: dur(450), ease: 'Quad.easeOut',
      onComplete: () => {
        this.ring(x, y);
        this.phase = 'angling';
        this.angling = createAngling(factors().anim);
        const id = pickFish({ x, y }, this.fishes.map((f) => ({ id: f.id, x: f.c.x, y: f.c.y })));
        const rec = this.fishes.find((f) => f.id === id);
        if (rec) this.startApproach(rec);
      },
    });
  }

  ring(x, y) {
    const ring = this.add.image(x, y, 'splash-ring').setDepth(D.line).setScale(0.3).setAlpha(0.9);
    this.tweens.add({ targets: ring, scale: 0.9, alpha: 0, duration: dur(600), onComplete: () => ring.destroy() });
  }

  // The fish swims up to the bobber, mouth first.
  startApproach(rec) {
    this.stopSwim(rec);
    this.angled = rec;
    const b = this.bobber;
    const dist = Math.hypot(b.x - rec.c.x, b.y - rec.c.y);
    this.angling = approach(this.angling, rec.id, rec.info.size, dist, Math.random);
    rec.dir = b.x >= rec.c.x ? 1 : -1;
    this.face(rec);
    const mouth = 95 * rec.base; // from the fish centre to its mouth
    rec.tween = this.tweens.add({
      targets: rec.c, x: b.x - rec.dir * mouth, y: b.y + 10,
      duration: Math.max(1, this.angling.approachMs), ease: 'Sine.easeOut',
    });
  }

  onAnglingEvent(e) {
    const b = this.bobber;
    switch (e) {
      case 'summon': {
        // The nearest fish comes, however far: the wait stays short.
        const pool = this.fishes.filter((f) => f !== this.angled);
        const id = pickFish(this.bobber, pool.map((f) => ({ id: f.id, x: f.c.x, y: f.c.y })), Infinity);
        const rec = pool.find((f) => f.id === id);
        if (rec) this.startApproach(rec);
        break;
      }
      case 'nibble':
        this.tweens.add({ targets: b, y: b.y + 8, duration: dur(110), yoyo: true, repeat: 1 });
        if (this.angled) this.tweens.add({ targets: this.angled.c, x: `+=${this.angled.dir * 14}`, duration: dur(150), yoyo: true });
        break;
      case 'bite':
        this.tweens.add({ targets: b, y: b.y + 26, alpha: 0.65, duration: dur(160), ease: 'Quad.easeIn' });
        splash(this, b.x, b.y, 0xffffff);
        this.ring(b.x, b.y);
        break;
      case 'thrashStart':
        if (this.angled) {
          this.wiggle = this.tweens.add({
            targets: this.angled.c, angle: { from: -16, to: 16 }, duration: dur(90), yoyo: true, repeat: -1,
          });
          splash(this, this.angled.c.x, this.angled.c.y, 0xffffff);
        }
        break;
      case 'thrashEnd':
        this.stopWiggle();
        break;
      case 'missed':
      case 'spooked':
        this.letFishGo();
        this.reelBack(() => { this.phase = 'idle'; });
        break;
      case 'broken':
        this.snap();
        break;
      case 'landed':
        this.land();
        break;
      default:
    }
  }

  onHooked() {
    const rec = this.angled;
    this.stopSwim(rec);
    this.hookFrom = { x: rec.c.x, y: rec.c.y };
    this.tweens.killTweensOf(this.bobber); // the bite's sinking tween: the bobber is back up
    this.bobber.setAlpha(1);
    // Reeled in mouth first, towards the shore under the rod.
    rec.dir = SHORE.x >= rec.c.x ? 1 : -1;
    this.face(rec);
    splash(this, rec.c.x, rec.c.y, 0xffffff);
  }

  // Fight frame: the fish moves from where it was hooked to the shore as it is reeled in; the
  // rod bends with the tension (and a little while she pulls).
  drawFight() {
    const a = this.angling;
    const rec = this.angled;
    if (!rec || !this.hookFrom) return;
    const k = 1 - a.distance;
    rec.c.x = Phaser.Math.Linear(this.hookFrom.x, SHORE.x, k);
    rec.c.y = Phaser.Math.Linear(this.hookFrom.y, SHORE.y, k);
    this.bobber.setPosition(rec.c.x + rec.dir * 95 * rec.base, rec.c.y - 10); // at its mouth
    this.rod.angle = ROD_BEND * Math.min(1, tension01(a)) + (this.holding ? 6 : 0);
  }

  stopWiggle() {
    if (this.wiggle) { this.wiggle.remove(); this.wiggle = null; }
    if (this.angled) this.angled.c.angle = 0;
  }

  // The fish on the line goes back to wandering the pond.
  letFishGo() {
    const rec = this.angled;
    this.stopWiggle();
    this.angled = null;
    this.hookFrom = null;
    this.angling = null;
    if (rec && rec.c.active) this.startSwim(rec);
  }

  reelBack(done, keepPhase = false) {
    if (!keepPhase) this.phase = 'busy';
    this.holding = false;
    this.angling = null;
    const tip = this.rodTip();
    this.tweens.add({ targets: this.rod, angle: 0, duration: dur(250) });
    this.tweens.add({
      targets: this.bobber, x: tip.x, y: tip.y, alpha: 1, duration: dur(350), ease: 'Quad.easeIn',
      onComplete: () => {
        this.bobber.setVisible(false);
        this.lineOn = false;
        if (done) done();
      },
    });
  }

  // Held through a thrash: the line snaps ("clac"), the fish gets away. No penalty.
  snap() {
    const b = this.bobber;
    const tip = this.rodTip();
    const g = this.add.graphics().setDepth(D.line + 2);
    g.lineStyle(8, 0xffffff, 1).lineBetween(tip.x, tip.y, b.x, b.y);
    this.tweens.add({ targets: g, alpha: 0, duration: dur(250), onComplete: () => g.destroy() });
    splash(this, b.x, b.y, 0xffffff); // a plain white burst: sparkles mean a reward
    this.lineOn = false;
    b.setVisible(false);
    this.holding = false;
    this.tweens.add({ targets: this.rod, angle: -8, duration: dur(120), yoyo: true, onComplete: () => this.rod.setAngle(0) });
    this.letFishGo();
    this.phase = 'busy';
    this.time.delayedCall(dur(500), () => { if (this.phase === 'busy') this.phase = 'idle'; });
  }

  // Reeled in to the shore: on to the list (or the cross if it was not asked for).
  land() {
    const rec = this.angled;
    this.stopWiggle();
    this.angled = null;
    this.hookFrom = null;
    this.angling = null;
    this.holding = false;
    this.lineOn = false;
    this.bobber.setVisible(false);
    this.tweens.add({ targets: this.rod, angle: 0, duration: dur(250) });
    this.phase = 'busy';
    this.stopSwim(rec);
    rec.dir = 1;
    this.face(rec);
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
        c.setDepth(D.fish + SIZE_DEPTH[rec.info.size]);
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

  update(time, delta) {
    if (this.phase === 'angling' && this.angling) {
      const { a, events } = step(this.angling, delta, this.holding, Math.random);
      this.angling = a;
      for (const e of events) this.onAnglingEvent(e);
      if (this.phase === 'angling' && a.phase === 'fight') this.drawFight();
    }
    this.drawLine();
  }

  // The rod tip, following the rod's bend.
  rodTip() {
    const t = Phaser.Math.DegToRad(this.rod.angle);
    return {
      x: ROD_BUTT.x + ROD_VEC.x * Math.cos(t) - ROD_VEC.y * Math.sin(t),
      y: ROD_BUTT.y + ROD_VEC.x * Math.sin(t) + ROD_VEC.y * Math.cos(t),
    };
  }

  drawLine() {
    this.line.clear();
    if (!this.lineOn) return;
    const k = this.angling?.phase === 'fight' ? Math.min(1, tension01(this.angling)) : 0;
    const color = k < 0.5
      ? Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(LINE_COLORS[0]), Phaser.Display.Color.IntegerToColor(LINE_COLORS[1]), 50, k * 100)
      : Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(LINE_COLORS[1]), Phaser.Display.Color.IntegerToColor(LINE_COLORS[2]), 50, (k - 0.5) * 100);
    const tip = this.rodTip();
    this.line.lineStyle(3 + 3 * k, Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1)
      .lineBetween(tip.x, tip.y, this.bobber.x, this.bobber.y - 26);
  }

  // Fades out, then opens the collection home (the game is two levels below it).
  goHome() {
    if (this.__leaving) return;
    this.__leaving = {};
    this.cameras.main.once('camerafadeoutcomplete', () => { window.location.href = HOME_URL; });
    this.cameras.main.fadeOut(250);
  }
}
