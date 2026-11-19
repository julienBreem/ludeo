// Paint: pick a glaze pot, then finger-paint the top-down cake until it is covered.
// Coverage lives on the 64x64 paint grid; the visible glaze is a RenderTexture under the cake's
// shape mask, and each move only draws the cells that changed (no full redraw while painting).
import { W, H, OUTLINE, COLOR_HEX } from '../config.js';
import { getRound, getState } from '../game-state.js';
import { ownedKeys } from '../logic/catalog.js';
import { createPaintGrid, GRID, BRUSH_RADIUS } from '../logic/paint.js';
import { judgeColor, COVERAGE_OK } from '../logic/scoring.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { drawCake, shapeMask, FRAME } from '../ui/cakeView.js';
import { goNext, restart } from '../ui/flow.js';

const CAKE_X = 540;
const CAKE_Y = 375;
const CAKE_SIZE = 480;
const SCALE = CAKE_SIZE / FRAME; // screen px per frame unit
const CELL = CAKE_SIZE / GRID; // screen px per grid cell (glaze texture is drawn at screen resolution)
const SHELF_Y = 728;
const POT_STEP = 150;
const POT_SIZE = 124;
const POT_LIFT = 26;
const BAR_X = 880;
const BAR_Y = 375;
const BAR_W = 330;
const BAR_H = 56;
const STAMP_STEP = BRUSH_RADIUS * 0.5; // cells between brush stamps along a fast stroke

export class PaintScene extends Phaser.Scene {
  constructor() {
    super('Paint');
  }

  create() {
    const round = getRound();
    this.round = round;
    if (window.__game) window.__round = round;
    const shape = round.cake.shape ?? round.order.shape;
    this.colorKeys = ownedKeys(getState().owned, 'color');
    this.selected = 0; // 1-based index into colorKeys, 0 = no pot chosen
    this.mask = shapeMask(this, shape);
    this.grid = createPaintGrid(this.mask, GRID);
    this.stroke = null; // {id, u, v}
    this.painted = false;

    this.cameras.main.setBackgroundColor(0xf3e5f5);
    addOrderReminder(this, round.order, 'couleur');

    this.cake = drawCake(this, CAKE_X, CAKE_Y, { ...round.cake, shape, glaze: null, toppings: [] },
      { size: CAKE_SIZE, view: 'top' });
    // Glaze layer: drawn at screen resolution, scaled back to frame units inside the masked
    // sub-container, right above the (empty) glaze Graphics.
    this.layer = this.add.renderTexture(0, 0, CAKE_SIZE, CAKE_SIZE).setScale(1 / SCALE);
    this.cake.glaze.parentContainer.add(this.layer);
    this.brush = this.make.graphics({ x: 0, y: 0 }, false);

    this.drawShelf();
    this.drawBar();

    this.input.on('pointerdown', (p, over) => this.onDown(p, over));
    this.input.on('pointermove', p => this.onMove(p));
    this.input.on('pointerup', p => this.onUp(p));
    this.input.on('pointerupoutside', p => this.onUp(p));

    this.bar = addStepBar(this, { onRestart: () => restart(this), onValidate: () => this.validate() });
  }

  drawShelf() {
    this.add.rectangle(W / 2, H - 70, W, 140, 0xc98a4b).setDepth(1);
    this.add.rectangle(W / 2, H - 140, W, 10, 0xe0a766).setDepth(1);
    const x0 = W / 2 - ((this.colorKeys.length - 1) * POT_STEP) / 2;
    this.pots = this.colorKeys.map((key, i) => {
      const pot = this.add.image(x0 + i * POT_STEP, SHELF_Y, 'pot').setTint(COLOR_HEX[key]).setDepth(5);
      pot.setScale(POT_SIZE / pot.width);
      pot.homeY = SHELF_Y;
      pot.setInteractive({ useHandCursor: true });
      pot.on('pointerdown', () => this.selectPot(i + 1));
      return pot;
    });
  }

  drawBar() {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x000000, 0.15).fillRoundedRect(BAR_X + 3, BAR_Y - BAR_H / 2 + 5, BAR_W, BAR_H, BAR_H / 2);
    g.fillStyle(0x6d4c41, 0.3).fillRoundedRect(BAR_X, BAR_Y - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2);
    this.barFill = this.add.graphics().setDepth(6);
    const o = this.add.graphics().setDepth(7);
    o.lineStyle(5, OUTLINE, 1).strokeRoundedRect(BAR_X, BAR_Y - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2);
    this.barPot = this.add.image(BAR_X - 4, BAR_Y, 'pot').setDepth(8).setVisible(false);
    this.barPot.setScale(84 / this.barPot.width);
    this.updateBar();
  }

  // Coverage of the selected colour; the bar is full once that colour covers COVERAGE_OK.
  updateBar() {
    const g = this.barFill;
    g.clear();
    if (!this.selected) return;
    const key = this.colorKeys[this.selected - 1];
    const cov = this.grid.coverage(this.colorKeys)[key] ?? 0;
    const f = Math.min(1, cov / COVERAGE_OK);
    const w = Math.max(BAR_H, f * BAR_W);
    if (f <= 0) return;
    g.fillStyle(COLOR_HEX[key], 1).fillRoundedRect(BAR_X, BAR_Y - BAR_H / 2, w, BAR_H, BAR_H / 2);
    g.fillStyle(0xffffff, 0.4).fillRoundedRect(BAR_X + 12, BAR_Y - BAR_H / 2 + 8, Math.max(0, w - 24), 12, 6);
  }

  selectPot(idx) {
    if (this.selected === idx) return;
    this.selected = idx;
    this.pots.forEach((pot, i) => {
      const on = i + 1 === idx;
      this.tweens.killTweensOf(pot);
      this.tweens.add({
        targets: pot, y: on ? pot.homeY - POT_LIFT : pot.homeY, scale: (POT_SIZE / pot.width) * (on ? 1.12 : 1),
        angle: 0, duration: 160, ease: 'Back.easeOut',
      });
    });
    this.barPot.setTint(COLOR_HEX[this.colorKeys[idx - 1]]).setVisible(true);
    this.updateBar();
  }

  // Pointer (screen) -> continuous grid coordinates (cell x + 0.5 is a cell centre).
  toCell(p) {
    return {
      u: ((p.x - CAKE_X) / SCALE + FRAME / 2) * (GRID / FRAME),
      v: ((p.y - CAKE_Y) / SCALE + FRAME / 2) * (GRID / FRAME),
    };
  }

  onDown(p, over) {
    if (this.stroke || over.length) return;
    const { u, v } = this.toCell(p);
    const onCake = u >= 0 && v >= 0 && u < GRID && v < GRID && this.mask[Math.floor(v) * GRID + Math.floor(u)];
    if (!this.selected) {
      if (onCake) this.nudgePots();
      return;
    }
    this.stroke = { id: p.id, u, v };
    this.paintSegment(u, v, u, v);
  }

  onMove(p) {
    if (!this.stroke || p.id !== this.stroke.id || !p.isDown) return;
    const { u, v } = this.toCell(p);
    this.paintSegment(this.stroke.u, this.stroke.v, u, v);
    this.stroke.u = u;
    this.stroke.v = v;
  }

  onUp(p) {
    if (this.stroke && p.id === this.stroke.id) this.stroke = null;
  }

  // Stamps the brush along (u0,v0)->(u1,v1), then draws only the cells whose colour changed.
  paintSegment(u0, v0, u1, v1) {
    const r = BRUSH_RADIUS;
    const x0 = Math.max(0, Math.floor(Math.min(u0, u1) - r));
    const x1 = Math.min(GRID - 1, Math.ceil(Math.max(u0, u1) + r));
    const y0 = Math.max(0, Math.floor(Math.min(v0, v1) - r));
    const y1 = Math.min(GRID - 1, Math.ceil(Math.max(v0, v1) + r));
    if (x0 > x1 || y0 > y1) return; // the whole segment is off the grid
    const cells = this.grid.cells;
    const bw = x1 - x0 + 1;
    const before = new Uint8Array(bw * (y1 - y0 + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) before[(y - y0) * bw + x - x0] = cells[y * GRID + x];

    const n = Math.max(1, Math.ceil(Math.hypot(u1 - u0, v1 - v0) / STAMP_STEP));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = u0 + (u1 - u0) * t;
      const v = v0 + (v1 - v0) * t;
      if (u < -r || v < -r || u > GRID + r || v > GRID + r) continue;
      this.grid.paint(u, v, this.selected, r);
    }

    const g = this.brush;
    g.clear();
    g.fillStyle(COLOR_HEX[this.colorKeys[this.selected - 1]], 1);
    let changed = 0;
    for (let y = y0; y <= y1; y++) {
      let run = -1; // start of the current run of changed cells in this row (one rect per run)
      for (let x = x0; x <= x1 + 1; x++) {
        const diff = x <= x1 && cells[y * GRID + x] !== before[(y - y0) * bw + x - x0];
        if (diff && run < 0) run = x;
        if (!diff && run >= 0) {
          g.fillRect(run * CELL - 0.5, y * CELL - 0.5, (x - run) * CELL + 1, CELL + 1);
          changed += x - run;
          run = -1;
        }
      }
    }
    if (!changed) return;
    this.layer.draw(g);
    this.updateBar();
    if (!this.painted) {
      this.painted = true;
      this.bar.setValidateEnabled(true);
    }
  }

  // Painting with no pot chosen: the pots wiggle to show where to start.
  nudgePots() {
    this.pots.forEach((pot, i) => {
      if (this.tweens.isTweening(pot)) return;
      this.tweens.add({ targets: pot, angle: { from: -10, to: 10 }, duration: 90, yoyo: true, repeat: 1, delay: i * 50,
        onComplete: () => pot.setAngle(0) });
    });
  }

  validate() {
    const order = this.round.order;
    this.round.results.couleur = judgeColor(this.grid.coverage(this.colorKeys), order);
    this.round.cake.glaze = { cells: Uint8Array.from(this.grid.cells), size: GRID, colorKeys: [...this.colorKeys] };
    goNext(this);
  }
}
