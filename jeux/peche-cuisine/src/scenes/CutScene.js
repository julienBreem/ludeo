// Cutting at level 1. The chosen fish come onto the board one at a time, drawn big, with dotted
// lines where to cut (a fish of weight n gives n portions). A vertical swipe across the fish near a
// line cuts there: the knife goes down and the piece on the right slides a little. A swipe far
// from every line does nothing. A fish of weight 1 needs no cut. Once every fish is cut, ✓.
// The fish is drawn as one piece per portion (body and details cropped), side by side, so a cut
// only has to move the pieces apart.
import { W, H, TOUCH, BG, COLOR_HEX } from '../config.js';
import { addIconButton } from '../ui/button.js';
import { goTo, restart } from '../ui/flow.js';
import { dur } from '../ui/pace.js';
import { popIn, sparkle } from '../ui/fx.js';
import { weightTag } from '../ui/fishArt.js';
import { getRound } from '../game-state.js';
import { cutMarks, snapCut } from '../logic/cutting.js';

const HOME_URL = '../../index.html';

const FRAME = { w: 240, h: 140 }; // fish-body / fish-details frame
const BODY = { left: 30, right: 196, top: 14, bottom: 126 }; // the body (tail excluded), frame px
const SPAN = 520; // on-screen width of the body, whatever the fish's size: easy to cut
const FISH = { x: 600, y: 420 };
const BOARD = { x: 640, y: 430, scale: 3.1 };
const GAP = 16; // px a piece slides away at each cut
const DONE = { y: 92, firstX: 330, gap: 170, scale: 0.35, pieceGap: 6 }; // finished fish, pieces kept apart
const TAG = { x: 1080, y: 230 };
const SWIPE = { reach: 0.3, maxSlant: 1 }; // the stroke must reach within 30% of the body's top and bottom
const RESTART = { x: W - 24 - TOUCH / 2, y: H - 24 - TOUCH / 2 - TOUCH - 24 };
const D = { board: 10, fish: 100, marks: 120, knife: 200, done: 150, ok: 400, home: 500 };

export class CutScene extends Phaser.Scene {
  constructor() {
    super('Cut');
  }

  create() {
    // Phaser reuses the instance: every per-run field is reset here.
    this.round = getRound();
    this.fishes = this.round.chosen ?? [];
    this.index = -1;
    this.current = null; // { fish, pieces, marks, done, scale }
    this.tag = null;
    this.stroke = null;
    this.phase = 'busy'; // idle (cutting) | busy | done
    this.doneCount = 0;
    this.__leaving = null;

    this.cameras.main.setBackgroundColor(BG);
    this.add.image(W / 2, H / 2, 'kitchen-bg').setDepth(0);
    this.add.image(BOARD.x, BOARD.y, 'board').setScale(BOARD.scale).setDepth(D.board);
    this.marksGfx = this.add.graphics().setDepth(D.marks);
    this.knife = this.add.image(0, 0, 'knife').setScale(1.2).setDepth(D.knife).setVisible(false);

    addIconButton(this, 24 + TOUCH / 2, 24 + TOUCH / 2, 'icon-home', () => this.goHome()).setDepth(D.home);
    addIconButton(this, RESTART.x, RESTART.y, 'icon-restart', () => restart(this)).setDepth(D.ok);

    this.input.on('pointerdown', (p) => this.strokeStart(p));
    this.input.on('pointermove', (p) => this.strokeMove(p));
    this.input.on('pointerup', () => { this.stroke = null; });

    this.nextFish();
  }

  // ---- one fish ----

  nextFish() {
    this.index += 1;
    if (this.index >= this.fishes.length) {
      this.allDone();
      return;
    }
    const fish = this.fishes[this.index];
    const scale = SPAN / (BODY.right - BODY.left);
    const marks = cutMarks(fish.weight);
    // the edges of each piece in frame px: the head and the tail stay on the end pieces
    const edges = [0, ...marks.map((m) => BODY.left + m * (BODY.right - BODY.left)), FRAME.w];
    const pieces = [];
    for (let i = 0; i < fish.weight; i++) {
      const piece = this.add.container(FISH.x, FISH.y).setScale(scale).setDepth(D.fish);
      for (const key of ['fish-body', 'fish-details']) {
        const img = this.add.image(0, 0, key);
        if (key === 'fish-body') img.setTint(COLOR_HEX[fish.color] ?? 0xffffff);
        img.setCrop(edges[i], 0, edges[i + 1] - edges[i], FRAME.h);
        piece.add(img);
      }
      pieces.push(piece);
    }
    this.current = { fish, pieces, marks, done: [], scale };

    // comes in from the right
    for (const p of pieces) p.x += W;
    this.tweens.add({
      targets: pieces, x: `-=${W}`, duration: dur(600), ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tag = weightTag(this, fish.weight, this.round.levels.cuisine).setPosition(TAG.x, TAG.y).setDepth(D.fish);
        popIn(this, this.tag);
        if (marks.length === 0) {
          // weight 1: nothing to cut, so it does not keep her waiting
          this.time.delayedCall(dur(300), () => this.fishDone());
          return;
        }
        this.drawMarks();
        this.phase = 'idle';
      },
    });
  }

  // Screen x of mark i (pieces right of every cut mark before it have slid by GAP).
  markX(i) {
    const cur = this.current;
    const shift = cur.done.filter((k) => k < i).length * GAP;
    return FISH.x + (BODY.left + cur.marks[i] * (BODY.right - BODY.left) - FRAME.w / 2) * cur.scale + shift;
  }

  bodyTop() { return FISH.y + (BODY.top - FRAME.h / 2) * this.current.scale; }

  bodyBottom() { return FISH.y + (BODY.bottom - FRAME.h / 2) * this.current.scale; }

  // Screen x -> 0..1 along the uncut body (the gaps of the cuts left of x are taken out).
  toX01(x) {
    const cur = this.current;
    let shift = 0;
    for (const k of cur.done) if (x > this.markX(k) + GAP / 2) shift += GAP;
    const left = FISH.x + (BODY.left - FRAME.w / 2) * cur.scale;
    return (x - shift - left) / ((BODY.right - BODY.left) * cur.scale);
  }

  drawMarks() {
    const g = this.marksGfx;
    g.clear();
    const cur = this.current;
    if (!cur) return;
    const top = this.bodyTop() - 30;
    const bottom = this.bodyBottom() + 30;
    g.fillStyle(0x1f2a44, 0.9);
    cur.marks.forEach((m, i) => {
      if (cur.done.includes(i)) return;
      const x = this.markX(i);
      for (let y = top; y < bottom; y += 26) g.fillRoundedRect(x - 4, y, 8, 14, 4);
    });
  }

  // ---- the swipe ----

  strokeStart(p) {
    this.stroke = this.phase === 'idle' ? { minY: p.y, maxY: p.y, x0: p.x, y0: p.y, last: { x: p.x, y: p.y }, crossX: null, used: false } : null;
  }

  strokeMove(p) {
    const s = this.stroke;
    if (!s || s.used || !p.isDown || this.phase !== 'idle') return;
    const mid = (this.bodyTop() + this.bodyBottom()) / 2;
    // where the stroke crosses the middle line of the body
    if ((s.last.y - mid) * (p.y - mid) <= 0 && s.last.y !== p.y) {
      const t = (mid - s.last.y) / (p.y - s.last.y);
      s.crossX = s.last.x + t * (p.x - s.last.x);
    }
    s.last = { x: p.x, y: p.y };
    s.minY = Math.min(s.minY, p.y);
    s.maxY = Math.max(s.maxY, p.y);
    const h = this.bodyBottom() - this.bodyTop();
    const across = s.minY <= this.bodyTop() + h * SWIPE.reach && s.maxY >= this.bodyBottom() - h * SWIPE.reach;
    const upright = Math.abs(p.x - s.x0) <= Math.abs(p.y - s.y0) * SWIPE.maxSlant;
    if (!across || !upright || s.crossX === null) return;
    s.used = true;
    const cur = this.current;
    const i = snapCut(this.toX01(s.crossX), cur.marks, cur.done);
    if (i >= 0) this.cut(i);
  }

  // Knife down at mark i, then every piece right of it slides by GAP.
  cut(i) {
    const cur = this.current;
    this.phase = 'busy';
    const x = this.markX(i);
    cur.done.push(i);
    this.drawMarks();
    this.knife.setVisible(true).setAlpha(1).setPosition(x + 40, this.bodyTop() - 90);
    this.tweens.add({
      targets: this.knife, y: this.bodyBottom() - 20, duration: dur(220), ease: 'Quad.easeIn',
      onComplete: () => {
        this.tweens.add({ targets: this.knife, alpha: 0, duration: dur(200), onComplete: () => this.knife.setVisible(false) });
        this.tweens.add({
          targets: cur.pieces.slice(i + 1), x: `+=${GAP}`, duration: dur(250), ease: 'Back.easeOut',
          onComplete: () => {
            this.drawMarks();
            if (cur.done.length === cur.marks.length) this.time.delayedCall(dur(500), () => this.fishDone());
            else this.phase = 'idle';
          },
        });
      },
    });
  }

  // The cut fish shrinks into the row of finished fish at the top.
  fishDone() {
    const cur = this.current;
    this.phase = 'busy';
    this.marksGfx.clear();
    sparkle(this, FISH.x, FISH.y);
    const tx = DONE.firstX + this.doneCount * DONE.gap;
    this.doneCount += 1;
    const n = cur.pieces.length;
    cur.pieces.forEach((p, j) => {
      p.setDepth(D.done);
      this.tweens.add({
        targets: p, x: tx + (j - (n - 1) / 2) * DONE.pieceGap, y: DONE.y, scaleX: DONE.scale, scaleY: DONE.scale,
        duration: dur(600), ease: 'Cubic.easeInOut',
      });
    });
    const tag = this.tag;
    this.tweens.add({ targets: tag, alpha: 0, duration: dur(300), onComplete: () => tag.destroy() });
    this.time.delayedCall(dur(700), () => this.nextFish());
  }

  allDone() {
    this.phase = 'done';
    this.current = null;
    const ok = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => goTo(this, 'Plate'))
      .setDepth(D.ok);
    popIn(this, ok);
  }

  // Fades out, then opens the collection home (the game is two levels below it).
  goHome() {
    if (this.__leaving) return;
    this.__leaving = {};
    this.cameras.main.once('camerafadeoutcomplete', () => { window.location.href = HOME_URL; });
    this.cameras.main.fadeOut(250);
  }
}
