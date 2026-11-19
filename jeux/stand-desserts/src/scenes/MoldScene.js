// Mold (theme `geometrie`), level read from the round (kept from the client's arrival):
// N1: 4 moulds (the ordered shape, a close trap when she owns one, two others). Each card shows the
//     mould seen from above (the trap pairs rond/ovale, carré/rectangle/losange read better than in
//     3/4) over the mould itself; tapping a card chooses it, the batter pours, and a small label
//     gives the shape's name (a complement: she is not asked to read it).
// N2: the same 4 cards, but the strip hides the shape; a clue card (pictogram + die, the word
//     under it) says what the mould has. Tapping a corner of a mould seen from above makes that
//     corner glow (tap again: off): she counts them herself, no number is shown. Tapping the
//     mould under it chooses it.
// N3: the mould in pieces (2-3, some turned): the target's outline is an empty slot; a tap turns a
//     piece a quarter turn, a drag moves it (never off the screen). A piece snaps in place when it
//     is turned right and dropped near a place it fits. ✓ once every piece is in place or on the
//     slot; right only if every piece snapped.
// The exercise is kept on the round (round.moldEx): ↺ starts the same one again.
import { W, H, BATTER, OUTLINE, TOP_SQUASH } from '../config.js';
import { getRound, getState } from '../game-state.js';
import { ownedKeys } from '../logic/catalog.js';
import { judgeShape } from '../logic/scoring.js';
import { makeMoldExercise } from '../logic/moldExercise.js';
import { pieceFits } from '../logic/tangram.js';
import { GRID } from '../logic/paint.js';
import { NOUNS } from '../logic/orderText.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { goNext, restart } from '../ui/flow.js';
import { splash, sparkle } from '../ui/fx.js';
import { dur, factors } from '../ui/pace.js';
import { shapeMask, FRAME } from '../ui/cakeView.js';
import { addTag, ensureWordTextures } from '../ui/words.js';
import {
  addSilhouette, cornerPoints, clueRow, clueWord, pieceTextures,
} from '../ui/moldArt.js';

// N1-N2 cards: the mould from above (top) over the mould in 3/4 (bottom).
const CARD_W = 280;
const CARD_H = 430;
const STEP = 294;
const CARD_Y = 448; // card centre: 233..663, clear of the strip (to y 200) and of ↺ / ✓ (from y 666)
const TOP_DY = -100; // silhouette centre, from the card centre
const TOP_SIZE = 220; // silhouette px (hexagone side ~92 px: each corner's tap zone is wider)
const TOP_ZONE_H = 230; // the top part of the card (corners at N2)
const MOLD_DY = 118;
const MOLD_SCALE = 0.4;
const FILL_MS = 900;
const BOWL_SCALE = 0.34;
const BOWL_DY = -190; // the bowl above the mould while pouring
const CORNER_R = 22;
const GLOW = 0xffd54f;
// N2 clue card, top centre (right of the widest strip, ~430 px)
const CLUE_X = 790;
const CLUE_Y = 116;
const CLUE_PICT = 84;
// N3 tangram
const SLOT_X = 420;
const SLOT_Y = 440;
const SLOT_K = 0.9; // screen px per frame px (slot and pieces)
const TRAY = { 2: [[850, 420], [1100, 470]], 3: [[830, 330], [1090, 360], [960, 570]] };
const SNAP_PX = 40; // x pace greenWindow
const HIT_MIN = 110; // a piece's tap / drag zone is never smaller (>= 96)
const KEEP_IN = 60; // a dragged piece's centre stays this far inside the screen
const DRAG_PX = 10;
const TURN_MS = 180;

export class MoldScene extends Phaser.Scene {
  constructor() {
    super('Mold');
  }

  create() {
    const round = getRound();
    this.round = round;
    if (window.__game) window.__round = round;
    this.chosen = null;
    this.pouring = false;
    this.cards = {};
    this.pieces = [];
    this.bar = null; // Phaser reuses the scene: not the last run's bar
    this.level = [1, 2, 3].includes(round.levels?.moule) ? round.levels.moule : 1;
    this.ex = this.exercise();
    if (this.level === 3 && !this.ex.pieces) this.level = 1; // no silhouette to cut (cannot happen in play)

    this.cameras.main.setBackgroundColor(0xe1f5fe);
    ensureWordTextures(this);
    addOrderReminder(this, round.order, 'moule', round.levels?.commande, { hideShape: this.level >= 2 });

    if (this.level === 3) {
      this.buildTangram();
    } else {
      if (this.level === 2) this.drawClue();
      const keys = this.ex.choices;
      const x0 = W / 2 - ((keys.length - 1) * STEP) / 2;
      keys.forEach((key, i) => this.addCard(key, x0 + i * STEP));
      this.bowl = this.add.image(0, 0, 'bowl').setScale(BOWL_SCALE).setDepth(20).setVisible(false);
      this.stream = this.add.rectangle(0, 0, 30, 100, BATTER).setOrigin(0.5, 0).setDepth(19).setVisible(false);
    }

    this.bar = addStepBar(this, { onRestart: () => restart(this), onValidate: () => this.validate() });
  }

  // The round's exercise at this level (made once per round, so ↺ keeps it).
  exercise() {
    const round = this.round;
    const shape = round.order.shape;
    const old = round.moldEx;
    if (old && old.level === this.level && old.shape === shape) return old;
    const owned = ownedKeys(getState().owned, 'shape');
    const opts = this.level === 3 ? { mask: shapeMask(this, shape), size: GRID } : {};
    const made = makeMoldExercise(round.order, this.level, owned, Math.random, opts);
    let pieces = null;
    if (made.pieces) {
      const { tex, masks } = pieceTextures(this, shape, made.pieces, GRID);
      const fits = pieceFits(masks);
      pieces = made.pieces.map((p, i) => ({ ...tex[i], rotation: p.rotation, fits: fits[i] }));
    }
    round.moldEx = { level: this.level, shape, choices: made.choices, clue: made.clue, pieces };
    return round.moldEx;
  }

  // ---- N1 / N2: choose a mould ------------------------------------------------------------------

  drawClue() {
    const { items, w: rowW } = clueRow(this, this.ex.clue, CLUE_PICT);
    const word = this.add.text(0, 58, clueWord(this.ex.clue), {
      fontFamily: 'Arial, Helvetica, sans-serif', fontStyle: 'bold', fontSize: '26px', color: '#1f2a44',
    }).setOrigin(0.5);
    for (const it of items) it.y = -16;
    const w = Math.max(rowW, word.width) + 48;
    const h = 170;
    const card = this.add.container(CLUE_X, CLUE_Y).setDepth(20);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.15).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 26);
    bg.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 26);
    bg.lineStyle(5, 0x66bb6a, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
    card.add([bg, ...items, word]);
    this.clueCard = card;
  }

  addCard(key, x) {
    const card = this.add.container(x, CARD_Y);
    const bg = this.add.graphics();
    card.add(bg);
    const drawBg = (selected) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.12).fillRoundedRect(-CARD_W / 2 + 3, -CARD_H / 2 + 6, CARD_W, CARD_H, 28);
      bg.fillStyle(selected ? 0xfff9c4 : 0xffffff, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 28);
      bg.lineStyle(selected ? 10 : 4, selected ? 0x66bb6a : OUTLINE, selected ? 1 : 0.5)
        .strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 28);
      // a faint line between the mould from above and the mould
      bg.lineStyle(3, OUTLINE, 0.12).lineBetween(-CARD_W / 2 + 24, TOP_DY + TOP_ZONE_H / 2, CARD_W / 2 - 24, TOP_DY + TOP_ZONE_H / 2);
    };
    drawBg(false);
    const top = addSilhouette(this, 0, TOP_DY, key, TOP_SIZE);
    card.add(top);
    const mold = this.add.container(0, MOLD_DY).setScale(MOLD_SCALE);
    mold.add(this.add.image(0, 0, `mold-${key}-back`));
    const slot = this.add.container(0, 0);
    mold.add(slot);
    mold.add(this.add.image(0, 0, `mold-${key}-front`));
    card.add(mold);
    const glows = this.add.container(0, TOP_DY);
    card.add(glows);

    const c = { key, card, slot, drawBg, top, glows, lit: new Map(), label: null };
    this.cards[key] = c;
    const topTop = TOP_DY - TOP_ZONE_H / 2;
    const lowH = CARD_H / 2 - (TOP_DY + TOP_ZONE_H / 2);
    if (this.level === 2) {
      // the top part: the corners; the bottom part (the mould): choose it
      const topZone = this.add.zone(0, topTop + TOP_ZONE_H / 2, CARD_W, TOP_ZONE_H).setInteractive({ useHandCursor: true });
      topZone.on('pointerup', (p) => this.tapCorner(c, p));
      card.add(topZone);
      const lowZone = this.add.zone(0, CARD_H / 2 - lowH / 2, CARD_W, lowH).setInteractive({ useHandCursor: true });
      lowZone.on('pointerup', () => this.select(key));
      card.add(lowZone);
    } else {
      const zone = this.add.zone(0, 0, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.select(key));
      card.add(zone);
    }
  }

  // N2: the corners of a card's mould seen from above, in the glows' space (frame px x TOP_SIZE).
  corners(c) {
    const k = TOP_SIZE / FRAME;
    return cornerPoints(c.key).map(([x, y]) => [x * k, y * k]);
  }

  // The same on the screen (tests).
  cornerScreen(key) {
    const c = this.cards[key];
    const m = c.glows.getWorldTransformMatrix();
    return this.corners(c).map(([x, y]) => { const p = m.transformPoint(x, y); return [p.x, p.y]; });
  }

  // N2: the corner nearest to the tap (the whole top part of the card is shared between the
  // corners) lights up, or goes out if it was lit. Round shapes have none: nothing happens.
  tapCorner(c, p) {
    const pts = this.corners(c);
    if (!pts.length) return;
    // the tap in the glows' own space (the card may be scaled while chosen)
    const local = c.glows.getWorldTransformMatrix().applyInverse(p.x, p.y);
    let best = 0;
    let bestD = Infinity;
    pts.forEach(([x, y], i) => {
      const d = Math.hypot(local.x - x, local.y - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    const on = c.lit.get(best);
    if (on) {
      c.lit.delete(best);
      this.tweens.add({ targets: on, scale: 0, alpha: 0, duration: dur(140), onComplete: () => on.destroy() });
      return;
    }
    const [x, y] = pts[best];
    const g = this.add.graphics({ x, y });
    g.fillStyle(GLOW, 0.45).fillCircle(0, 0, CORNER_R + 10);
    g.fillStyle(GLOW, 1).fillCircle(0, 0, CORNER_R);
    g.lineStyle(4, OUTLINE, 0.8).strokeCircle(0, 0, CORNER_R);
    g.setScale(0);
    c.glows.add(g);
    c.lit.set(best, g);
    this.tweens.add({ targets: g, scale: 1, duration: dur(220), ease: 'Back.easeOut' });
  }

  select(key) {
    if (this.pouring || this.chosen === key) return;
    if (this.chosen) this.clear();
    this.chosen = key;
    const c = this.cards[key];
    c.drawBg(true);
    this.tweens.add({ targets: c.card, scale: 1.02, duration: 160, ease: 'Back.easeOut' });
    if (this.level === 1 && !c.label) {
      // the name, small, on the card's top edge (a complement: the picture is the clue)
      c.label = addTag(this, 0, -CARD_H / 2, NOUNS.shape[key]?.word ?? key, { fontSize: 22 });
      c.card.add(c.label);
      c.label.setScale(0);
      this.tweens.add({ targets: c.label, scale: 1, duration: dur(200), ease: 'Back.easeOut' });
    }
    this.pour(key);
  }

  // Un-fills the chosen mold (switching molds).
  clear() {
    const c = this.cards[this.chosen];
    if (!c) return;
    c.drawBg(false);
    this.tweens.add({ targets: c.card, scale: 1, duration: 120 });
    c.slot.removeAll(true);
    this.chosen = null;
    this.bar.setValidateEnabled(false);
  }

  pour(key) {
    this.pouring = true;
    const c = this.cards[key];
    const x = c.card.x;
    const targetY = CARD_Y + MOLD_DY;
    const bowlY = targetY + BOWL_DY;
    const lipY = bowlY + 40;

    const box = this.add.container(0, 0).setScale(0);
    const face = this.add.image(0, 0, `shape-${key}-fill`).setTint(BATTER);
    face.setScale(1, TOP_SQUASH);
    box.add(face);
    const shine = this.add.ellipse(-50, -22, 110, 36, 0xffffff, 0.35);
    box.add(shine);
    if (this.round.cake.doughOk === false) {
      const lumps = this.add.image(0, 0, 'lumps');
      lumps.setScale(1, TOP_SQUASH);
      box.add(lumps);
    }
    c.slot.add(box);

    this.bowl.setPosition(x - 70, bowlY).setAngle(0).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.bowl, angle: -28, x: x - 90, duration: dur(300), ease: 'Quad.easeOut' });

    this.stream.setPosition(x - 8, lipY).setScale(1, 0).setAlpha(1).setVisible(true);
    this.tweens.add({
      targets: this.stream, scaleY: (targetY - lipY - 10) / 100, duration: dur(260), delay: dur(200), ease: 'Quad.easeIn',
      onComplete: () => splash(this, x - 8, targetY - 24, BATTER),
    });
    this.tweens.add({
      targets: box, scaleX: 1, scaleY: 1, duration: dur(FILL_MS), delay: dur(300), ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: this.stream, alpha: 0, scaleX: 0.2, duration: dur(200), onComplete: () => this.stream.setVisible(false) });
        this.tweens.add({
          targets: this.bowl, angle: 0, alpha: 0, duration: dur(300), onComplete: () => this.bowl.setVisible(false),
        });
        this.pouring = false;
        this.bar.setValidateEnabled(true);
      },
    });
  }

  // ---- N3: the mould in pieces ------------------------------------------------------------------

  // Where a piece's centre goes when it fills place j (screen px).
  home(j) {
    const p = this.ex.pieces[j];
    return [SLOT_X + (p.cx - FRAME / 2) * SLOT_K, SLOT_Y + (p.cy - FRAME / 2) * SLOT_K];
  }

  buildTangram() {
    const shape = this.ex.shape;
    // the empty slot: the silhouette, pale, with its outline
    this.slot = this.add.container(SLOT_X, SLOT_Y).setScale(SLOT_K);
    this.slot.add(this.add.image(0, 0, `shape-${shape}-fill`).setTint(0xb3c7d6).setAlpha(0.55));
    this.slot.add(this.add.image(0, 0, `shape-${shape}-line`).setTint(0x37474f));
    this.slotBox = new Phaser.Geom.Rectangle(SLOT_X - (FRAME / 2) * SLOT_K, SLOT_Y - (FRAME / 2) * SLOT_K, FRAME * SLOT_K, FRAME * SLOT_K);
    this.filled = new Map(); // place j -> piece index
    this.snapPx = SNAP_PX * Math.max(1, factors().greenWindow ?? 1);
    this.input.dragDistanceThreshold = DRAG_PX;
    const spots = TRAY[this.ex.pieces.length] ?? TRAY[3];
    this.ex.pieces.forEach((p, i) => {
      const img = this.add.image(0, 0, p.key).setScale(SLOT_K).setAngle(p.rotation).setDepth(10 + i);
      // the tray spot, moved in so that the whole (turned) piece is on the screen
      const side = (p.rotation / 90) % 2 ? [img.displayHeight, img.displayWidth] : [img.displayWidth, img.displayHeight];
      img.setPosition(
        Phaser.Math.Clamp(spots[i][0], side[0] / 2 + 16, W - side[0] / 2 - 16),
        Phaser.Math.Clamp(spots[i][1], side[1] / 2 + 16, H - 150 - side[1] / 2),
      );
      const hw = Math.max(img.width, HIT_MIN / SLOT_K);
      const hh = Math.max(img.height, HIT_MIN / SLOT_K);
      img.setInteractive({
        hitArea: new Phaser.Geom.Rectangle((img.width - hw) / 2, (img.height - hh) / 2, hw, hh),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        draggable: true,
        useHandCursor: true,
      });
      const piece = { i, img, rot: ((p.rotation % 360) + 360) % 360, place: null, dragged: false, turning: false };
      this.pieces.push(piece);
      img.on('pointerdown', (ptr) => {
        piece.dragged = false;
        piece.grab = [img.x - ptr.x, img.y - ptr.y]; // the piece keeps its place under the finger
      });
      img.on('dragstart', () => {
        piece.dragged = true;
        this.raise(piece);
      });
      img.on('drag', (ptr) => {
        const x = ptr.x + piece.grab[0];
        const y = ptr.y + piece.grab[1];
        img.setPosition(Phaser.Math.Clamp(x, KEEP_IN, W - KEEP_IN), Phaser.Math.Clamp(y, KEEP_IN, H - KEEP_IN));
      });
      img.on('dragend', () => this.tryPlace(piece));
      img.on('pointerup', () => {
        if (!piece.dragged) this.turn(piece);
      });
    });
    this.updateValidate();
  }

  raise(piece) {
    this.topDepth = (this.topDepth ?? 20) + 1;
    piece.img.setDepth(this.topDepth);
  }

  // A quarter turn clockwise.
  turn(piece) {
    if (piece.place !== null || piece.turning) return;
    piece.turning = true;
    piece.rot = (piece.rot + 90) % 360;
    this.raise(piece);
    this.tweens.add({
      targets: piece.img, angle: piece.img.angle + 90, duration: dur(TURN_MS), ease: 'Sine.easeOut',
      onComplete: () => {
        piece.turning = false;
        piece.img.setAngle(piece.rot);
        this.tryPlace(piece);
      },
    });
  }

  // Snaps the piece into a free place it fits at its current turn, if it is near it.
  tryPlace(piece) {
    if (piece.place !== null) return;
    const fits = this.ex.pieces[piece.i].fits[piece.rot / 90] ?? [];
    let best = null;
    let bestD = Infinity;
    for (const j of fits) {
      if (this.filled.has(j)) continue;
      const [hx, hy] = this.home(j);
      const d = Math.hypot(piece.img.x - hx, piece.img.y - hy);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best !== null && bestD <= this.snapPx) {
      piece.place = best;
      this.filled.set(best, piece.i);
      const [hx, hy] = this.home(best);
      piece.img.disableInteractive();
      piece.img.setDepth(5); // under the pieces still to place
      this.tweens.add({
        targets: piece.img, x: hx, y: hy, duration: dur(140), ease: 'Sine.easeOut',
        onComplete: () => {
          this.tweens.add({ targets: piece.img, scale: { from: SLOT_K * 1.05, to: SLOT_K }, duration: dur(160) });
          if (this.filled.size === this.pieces.length) sparkle(this, SLOT_X, SLOT_Y);
        },
      });
    }
    this.updateValidate();
  }

  // ✓ once every piece is in its place or lies on the slot.
  updateValidate() {
    const done = this.pieces.every(p => p.place !== null || this.slotBox.contains(p.img.x, p.img.y));
    this.bar?.setValidateEnabled(done);
  }

  validate() {
    const shape = this.round.order.shape;
    if (this.level === 3) {
      const ok = this.pieces.every(p => p.place !== null);
      this.round.results.moule = ok ? { ok: true } : { ok: false, reason: 'pieces' };
      this.round.cake.shape = shape;
      goNext(this);
      return true;
    }
    if (!this.chosen) return false;
    this.round.results.moule = judgeShape(this.chosen, this.round.order);
    this.round.cake.shape = this.chosen;
    goNext(this);
    return true;
  }
}
