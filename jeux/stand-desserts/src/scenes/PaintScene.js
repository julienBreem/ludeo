// Paint: pick a glaze pot, then finger-paint the top-down cake until it is covered.
// Coverage lives on the 64x64 paint grid; the visible glaze is a RenderTexture under the cake's
// shape mask, and each move only draws the cells that changed (no full redraw while painting).
// Multi-colour orders split the top into vertical zones, shown as dotted guide lines (painting
// crosses them). On a tart the crust rim covers the outer band: those cells are not paintable and
// do not count.
// Levels (theme couleurs-fractions): N1 the owned ready-made colours, 1 or 2 halves, dotted lines.
// N2 the base pots (rouge, bleu, jaune, blanc + bought bases) and a mixing bowl: a pot dragged onto
// the bowl pours into it, a second pot mixes (colors.js mix: an unknown mix is the muddy
// « mélange raté », which paints but is always wrong); the pot button beside the bowl puts the new
// colour on the shelf (and selects it); tapping the bowl empties it. Up to 3 equal zones, dotted
// lines. N3 the same shelf and bowl, 3 or 4 bands of equal area (zones.js equalArea) where a colour
// may cover several adjacent ones (thirds, quarters), no dotted lines: graduations on the rim at
// the band edges.
// colorKeys only grows (a cell's value is its index + 1), so a pot taken off a full shelf keeps the
// colour of what it painted.
import { W, H, OUTLINE, COLOR_HEX } from '../config.js';
import { getRound, getState } from '../game-state.js';
import { ownedKeys } from '../logic/catalog.js';
import { basesOf, mix } from '../logic/colors.js';
import { dur } from '../ui/pace.js';
import { ensureMixTextures, drawRimTicks, BOWL_W, BOWL_H, BOWL_OPENING } from '../ui/mixArt.js';
import { createPaintGrid, GRID, BRUSH_RADIUS } from '../logic/paint.js';
import { zoneMap, zoneEdges, bandOptions } from '../logic/zones.js';
import { judgeColor, minZoneCoverage, COVERAGE_OK } from '../logic/scoring.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { drawCake, shapeMask, rimMask, FRAME } from '../ui/cakeView.js';
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
const CELL_F = FRAME / GRID; // frame units per grid cell
const DASH = 14; // zone guide dash length / gap, in frame units
const DASH_GAP = 10;
// N2-N3 shelf: 9 slots (the bases first, then the pots she made), pots of 96 px (touch target)
const MIX_X0 = 220;
const MIX_STEP = 104;
const MIX_POT = 96;
const MIX_SLOTS = 9;
// the mixing bowl, under the paint bar, and the pot button on its left
const BOWL_X = 1040;
const BOWL_Y = 548;
const BOWL_SCALE = 0.6;
const POTBTN_X = 858;
const POTBTN_Y = 572;
const POTBTN_R = 56;
const DRAG_START = 14; // px a pot moves before it is a drag (less: a tap that selects it)

// Silhouette cells not under the rim, plus the rim's innermost ring of cells: a cell whose centre
// is under the rim can still show a sliver inside the rim's smooth edge, so the glaze reaches one
// cell under the rim (which is drawn over it) instead of leaving bare steps along the edge.
function paintableUnderRim(full, rim) {
  const open = full.map((m, i) => (m && !rim[i] ? 1 : 0));
  const out = Uint8Array.from(open);
  for (let i = 0; i < out.length; i++) {
    if (open[i] || !full[i]) continue;
    const x = i % GRID;
    const y = (i - x) / GRID;
    if ((x > 0 && open[i - 1]) || (x < GRID - 1 && open[i + 1])
      || (y > 0 && open[i - GRID]) || (y < GRID - 1 && open[i + GRID])) out[i] = 1;
  }
  return out;
}

export class PaintScene extends Phaser.Scene {
  constructor() {
    super('Paint');
  }

  create() {
    const round = getRound();
    this.round = round;
    if (window.__game) window.__round = round;
    const shape = round.cake.shape ?? round.order.shape;
    this.level = [1, 2, 3].includes(round.levels?.couleur) ? round.levels.couleur : 1;
    this.mixing = this.level >= 2;
    const owned = getState().owned;
    this.colorKeys = this.mixing ? basesOf(owned) : ownedKeys(owned, 'color');
    this.selected = 0; // 1-based index into colorKeys, 0 = no pot chosen
    this.potDrag = null; // N2-N3: {pot, id, x, y, ghost}
    this.bowlDown = false; // N2-N3: a press that started on the bowl (a tap there empties it)
    this.made = []; // N2-N3: the pots she made, oldest first
    const full = shapeMask(this, shape);
    this.full = full;
    // Paintable top: the silhouette minus the tart rim (all zeros when there is no rim).
    const rim = round.cake.dessert === 'tarte' ? rimMask(this, shape) : null;
    this.mask = rim ? paintableUnderRim(full, rim) : full;
    const nZones = Math.max(1, round.order.glaze.length);
    // Zones cut the silhouette as on the order picture (equal widths, equal areas at N3:
    // order.equalArea); cells under the rim count in no zone.
    this.nZones = nZones;
    const bands = bandOptions(round.order);
    this.zones = zoneMap(full, GRID, nZones, bands);
    if (rim) for (let i = 0; i < this.zones.length; i++) if (!this.mask[i]) this.zones[i] = -1;
    this.edges = zoneEdges(full, GRID, nZones, bands);
    this.grid = createPaintGrid(this.mask, GRID);
    this.stroke = null; // {id, u, v}
    this.painted = false;

    this.cameras.main.setBackgroundColor(0xf3e5f5);
    addOrderReminder(this, round.order, 'couleur', round.levels?.commande);

    this.cake = drawCake(this, CAKE_X, CAKE_Y, { ...round.cake, shape, glaze: null, toppings: [] },
      { size: CAKE_SIZE, view: 'top' });
    // Glaze layer: drawn at screen resolution, scaled back to frame units inside the masked
    // sub-container, right above the (empty) glaze Graphics.
    this.layer = this.add.renderTexture(0, 0, CAKE_SIZE, CAKE_SIZE).setScale(1 / SCALE);
    this.cake.glaze.parentContainer.add(this.layer);
    if (this.level >= 3) this.drawRimTicks(rim !== null);
    else this.drawZoneGuides();
    this.brush = this.make.graphics({ x: 0, y: 0 }, false);

    this.drawShelf();
    this.drawBar();
    if (this.mixing) this.drawBowl();

    this.input.on('pointerdown', (p, over) => this.onDown(p, over));
    this.input.on('pointermove', p => this.onMove(p));
    // any release ends a press on the bowl (the bowl's own pointerup runs before these)
    this.input.on('pointerup', (p) => { this.bowlDown = false; this.onUp(p); });
    this.input.on('pointerupoutside', (p) => { this.bowlDown = false; this.onUp(p); });

    this.bar = addStepBar(this, { onRestart: () => restart(this), onValidate: () => this.validate() });
  }

  // Dotted vertical lines at the zone edges, over the glaze (under the rim and outline), only
  // where the column crosses the paintable top. White dashes with a dark edge (still seen on white glaze).
  drawZoneGuides() {
    if (!this.edges.length) return;
    const g = this.add.graphics();
    const top = this.cake.top;
    top.addAt(g, top.getIndex(this.cake.glaze.parentContainer) + 1);
    for (const e of this.edges) {
      const a = Math.max(0, Math.ceil(e) - 1);
      const b = Math.min(GRID - 1, Math.floor(e));
      const x = e * CELL_F - FRAME / 2;
      let run = -1;
      for (let y = 0; y <= GRID; y++) {
        const inside = y < GRID && (this.mask[y * GRID + a] || this.mask[y * GRID + b]);
        if (inside && run < 0) run = y;
        if (!inside && run >= 0) {
          this.dashes(g, x, run * CELL_F - FRAME / 2, y * CELL_F - FRAME / 2);
          run = -1;
        }
      }
    }
  }

  // N3: graduations on the rim at the band edges (no dotted lines), above the outline.
  drawRimTicks(tart) {
    const g = this.add.graphics();
    this.cake.top.add(g);
    this.ticks = drawRimTicks(g, this.full, GRID, this.edges, FRAME, { inset: tart ? 0 : 9 });
  }

  dashes(g, x, ya, yb) {
    const len = yb - ya;
    const n = Math.max(1, Math.round((len + DASH_GAP) / (DASH + DASH_GAP)));
    const step = len / n; // spread the dashes evenly over the run
    const d = Math.min(DASH, step * 0.6);
    for (let i = 0; i < n; i++) {
      const y = ya + i * step + (step - d) / 2;
      g.fillStyle(0x4a2c2a, 0.55).fillRoundedRect(x - 4.5, y - 2, 9, d + 4, 4.5);
      g.fillStyle(0xffffff, 0.95).fillRoundedRect(x - 2.5, y, 5, d, 2.5);
    }
  }

  drawShelf() {
    this.add.rectangle(W / 2, H - 70, W, 140, 0xc98a4b).setDepth(1);
    this.add.rectangle(W / 2, H - 140, W, 10, 0xe0a766).setDepth(1);
    if (this.mixing) {
      this.pots = this.colorKeys.map((key, i) => this.addPot(i + 1, MIX_X0 + i * MIX_STEP));
      return;
    }
    const x0 = W / 2 - ((this.colorKeys.length - 1) * POT_STEP) / 2;
    this.pots = this.colorKeys.map((key, i) => this.addPot(i + 1, x0 + i * POT_STEP));
  }

  // A pot on the shelf for colorKeys[idx - 1]. N1: touching it selects it. N2-N3: a tap selects
  // it, a drag takes it to the bowl (onMove / onUp).
  addPot(idx, x) {
    const key = this.colorKeys[idx - 1];
    const size = this.mixing ? MIX_POT : POT_SIZE;
    const pot = this.add.image(x, SHELF_Y, 'pot').setTint(COLOR_HEX[key]).setDepth(5);
    pot.setScale(size / pot.width);
    pot.homeY = SHELF_Y;
    pot.size = size;
    pot.key = key;
    pot.idx = idx;
    pot.setInteractive({ useHandCursor: true });
    pot.on('pointerdown', (p) => {
      if (!this.mixing) this.selectPot(idx);
      else if (!this.potDrag && !this.stroke) this.potDrag = { pot, id: p.id, x: p.x, y: p.y, ghost: null };
    });
    return pot;
  }

  // ---- N2-N3: the mixing bowl -------------------------------------------------------------------
  drawBowl() {
    ensureMixTextures(this);
    const c = this.add.container(BOWL_X, BOWL_Y).setDepth(4).setScale(BOWL_SCALE);
    const bowl = this.add.image(0, 0, 'bowl-mix');
    // the liquid: one colour, or two halves (setCrop) the moment the second pot is poured
    const liquid = this.add.image(0, 0, 'bowl-mix-liquid').setVisible(false);
    const half = this.add.image(0, 0, 'bowl-mix-liquid').setVisible(false);
    const blob = this.add.image(0, -BOWL_H / 2 + BOWL_OPENING.y - 20, 'blob-rate').setScale(0.75).setVisible(false);
    c.add([bowl, liquid, half, blob]);
    this.bowl = { c, liquid, half, blob, content: null, pours: 0 };
    // the whole rim box is the drop zone and the tap target (216 x 156 px)
    this.bowlRect = new Phaser.Geom.Rectangle(BOWL_X - (BOWL_W * BOWL_SCALE) / 2, BOWL_Y - (BOWL_H * BOWL_SCALE) / 2,
      BOWL_W * BOWL_SCALE, BOWL_H * BOWL_SCALE);
    bowl.setInteractive({ useHandCursor: true });
    bowl.on('pointerdown', () => { this.bowlDown = true; });
    bowl.on('pointerup', () => {
      const tapped = this.bowlDown && !this.potDrag;
      this.bowlDown = false;
      if (tapped) this.emptyBowl();
    });

    // the pot button: an empty pot that fills with the bowl's colour once there is a new one
    const b = this.add.container(POTBTN_X, POTBTN_Y).setDepth(6).setVisible(false);
    const ring = this.add.graphics();
    ring.fillStyle(0x000000, 0.15).fillCircle(3, 5, POTBTN_R);
    ring.fillStyle(0xffffff, 1).fillCircle(0, 0, POTBTN_R);
    ring.lineStyle(5, OUTLINE, 1).strokeCircle(0, 0, POTBTN_R);
    const pot = this.add.image(0, 2, 'pot');
    pot.setScale(80 / pot.width);
    b.add([ring, pot]);
    b.pot = pot;
    b.setSize(POTBTN_R * 2, POTBTN_R * 2);
    b.setInteractive(new Phaser.Geom.Circle(POTBTN_R, POTBTN_R, POTBTN_R), Phaser.Geom.Circle.Contains);
    if (b.input) b.input.cursor = 'pointer';
    b.on('pointerup', () => this.makePot());
    this.potButton = b;
  }

  // Pours a pot into the bowl: the first one fills it, the next ones mix.
  pour(key) {
    const bw = this.bowl;
    const before = bw.content;
    bw.content = before ? mix(before, key) : key;
    bw.pours++;
    this.tweens.killTweensOf(bw.liquid);
    bw.liquid.setAlpha(1).setVisible(true).setCrop();
    bw.half.setVisible(false);
    if (!before) {
      bw.liquid.setTint(COLOR_HEX[key]);
      this.bounce(bw.liquid);
    } else {
      // the two colours side by side, then they blend into the result
      bw.liquid.setTint(COLOR_HEX[before]).setCrop(0, 0, BOWL_W / 2, BOWL_H);
      bw.half.setTint(COLOR_HEX[key]).setCrop(BOWL_W / 2, 0, BOWL_W / 2, BOWL_H).setAlpha(1).setVisible(true);
      const from = Phaser.Display.Color.ValueToColor(COLOR_HEX[before]);
      const to = Phaser.Display.Color.ValueToColor(COLOR_HEX[bw.content]);
      const result = bw.content;
      this.time.delayedCall(dur(350), () => {
        if (bw.content !== result) return;
        bw.liquid.setCrop();
        bw.half.setVisible(false);
        this.tweens.addCounter({
          from: 0, to: 100, duration: dur(500), ease: 'Sine.easeInOut',
          onUpdate: (t) => {
            if (bw.content !== result) return;
            const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, t.getValue());
            bw.liquid.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
          },
        });
      });
    }
    // the pot button (or the wiggle of the pot already there) once the colours have blended
    const result = bw.content;
    const done = () => {
      if (bw.content !== result) return;
      bw.blob.setVisible(result === 'melange');
      if (result === 'melange') this.bounce(bw.blob);
      this.updatePotButton();
    };
    if (before) this.time.delayedCall(dur(850), done);
    else done();
  }

  bounce(obj) {
    const sx = obj.scaleX;
    const sy = obj.scaleY;
    this.tweens.add({ targets: obj, scaleX: sx * 1.08, scaleY: sy * 1.08, duration: dur(140), yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => obj.setScale(sx, sy) });
  }

  emptyBowl() {
    const bw = this.bowl;
    if (!bw.content) return;
    bw.content = null;
    bw.pours = 0;
    bw.half.setVisible(false);
    bw.blob.setVisible(false);
    this.tweens.add({ targets: bw.liquid, alpha: 0, duration: dur(250), onComplete: () => bw.liquid.setVisible(false).setAlpha(1) });
    this.updatePotButton();
  }

  // The pot button shows when the bowl holds a colour that is not on the shelf yet; a colour
  // already there makes its pot wiggle instead.
  updatePotButton() {
    const key = this.bowl.content;
    const onShelf = key ? this.pots.find(p => p.key === key) : null;
    const show = !!key && !onShelf;
    const b = this.potButton;
    if (show && !b.visible) {
      b.setVisible(true).setScale(0.2);
      this.tweens.add({ targets: b, scale: 1, duration: dur(260), ease: 'Back.easeOut' });
    }
    if (!show) b.setVisible(false);
    if (show) b.pot.setTint(COLOR_HEX[key]);
    if (onShelf && this.bowl.pours >= 2) this.wiggle(onShelf);
  }

  wiggle(pot, delay = 0) {
    if (this.tweens.isTweening(pot)) return;
    this.tweens.add({ targets: pot, angle: { from: -10, to: 10 }, duration: 90, yoyo: true, repeat: 1, delay,
      onComplete: () => pot.setAngle(0) });
  }

  // The bowl's colour becomes a pot on the shelf (flying from the button), selected; the bowl is
  // emptied. A full shelf gives up the oldest pot she made (not the selected one).
  makePot() {
    const key = this.bowl.content;
    if (!key || this.pots.some(p => p.key === key)) return;
    let idx = this.colorKeys.indexOf(key) + 1;
    if (!idx) {
      this.colorKeys.push(key);
      idx = this.colorKeys.length;
    }
    let x;
    if (this.pots.length < MIX_SLOTS) {
      x = MIX_X0 + this.pots.length * MIX_STEP;
    } else {
      const old = this.made.find(p => p.idx !== this.selected) ?? this.made[0];
      x = old.x;
      this.made = this.made.filter(p => p !== old);
      this.pots = this.pots.filter(p => p !== old);
      this.tweens.killTweensOf(old);
      old.destroy();
    }
    const pot = this.addPot(idx, x);
    this.pots.push(pot);
    this.made.push(pot);
    pot.setPosition(POTBTN_X, POTBTN_Y).setDepth(20);
    this.potButton.setVisible(false);
    this.emptyBowl();
    this.tweens.add({
      targets: pot, x, y: SHELF_Y, duration: dur(420), ease: 'Quad.easeInOut',
      onComplete: () => { pot.setDepth(5); this.selectPot(idx, true); },
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

  // The least-covered zone, painted in any colour (so it tells nothing about which colour goes
  // where); the bar is full at COVERAGE_OK, i.e. only once every zone reaches it. Drawn in the
  // selected pot's colour.
  updateBar() {
    const g = this.barFill;
    g.clear();
    if (!this.selected) return;
    const key = this.colorKeys[this.selected - 1];
    const cov = minZoneCoverage(this.grid.cells, this.zones, this.nZones);
    this.barValue = cov / COVERAGE_OK; // read by tests
    const f = Math.min(1, cov / COVERAGE_OK);
    const w = Math.max(BAR_H, f * BAR_W);
    if (f <= 0) return;
    g.fillStyle(COLOR_HEX[key], 1).fillRoundedRect(BAR_X, BAR_Y - BAR_H / 2, w, BAR_H, BAR_H / 2);
    g.fillStyle(0xffffff, 0.4).fillRoundedRect(BAR_X + 12, BAR_Y - BAR_H / 2 + 8, Math.max(0, w - 24), 12, 6);
  }

  selectPot(idx, force = false) {
    if (this.selected === idx && !force) return;
    this.selected = idx;
    this.pots.forEach((pot) => {
      const on = pot.idx === idx;
      this.tweens.killTweensOf(pot);
      this.tweens.add({
        targets: pot, y: on ? pot.homeY - POT_LIFT : pot.homeY, scale: (pot.size / pot.width) * (on ? 1.12 : 1),
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
    const d = this.potDrag;
    if (d && p.id === d.id && p.isDown) {
      if (!d.ghost && Math.hypot(p.x - d.x, p.y - d.y) >= DRAG_START) {
        d.ghost = this.add.image(d.pot.x, d.pot.y, 'pot').setTint(COLOR_HEX[d.pot.key]).setDepth(50);
        d.ghost.setScale((d.pot.size / d.ghost.width) * 1.1);
        d.pot.setAlpha(0.4);
      }
      if (d.ghost) d.ghost.setPosition(p.x, p.y);
      return;
    }
    if (!this.stroke || p.id !== this.stroke.id || !p.isDown) return;
    const { u, v } = this.toCell(p);
    this.paintSegment(this.stroke.u, this.stroke.v, u, v);
    this.stroke.u = u;
    this.stroke.v = v;
  }

  onUp(p) {
    if (this.stroke && p.id === this.stroke.id) this.stroke = null;
    const d = this.potDrag;
    if (!d || p.id !== d.id) return;
    this.potDrag = null;
    if (!d.ghost) {
      this.selectPot(d.pot.idx);
      return;
    }
    const g = d.ghost;
    if (this.bowlRect.contains(p.x, p.y)) {
      // tipped over the bowl's rim, then poured
      this.tweens.add({
        targets: g, x: BOWL_X - 40, y: BOWL_Y - 70, angle: 60, duration: dur(180), ease: 'Quad.easeOut',
        onComplete: () => {
          this.pour(d.pot.key);
          this.tweens.add({ targets: g, alpha: 0, duration: dur(200), onComplete: () => g.destroy() });
          d.pot.setAlpha(1);
        },
      });
      return;
    }
    // dropped elsewhere: back to the shelf
    this.tweens.add({
      targets: g, x: d.pot.x, y: d.pot.y, duration: dur(220), ease: 'Quad.easeOut',
      onComplete: () => { g.destroy(); d.pot.setAlpha(1); },
    });
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
    this.pots.forEach((pot, i) => this.wiggle(pot, i * 50));
  }

  validate() {
    const order = this.round.order;
    this.round.results.couleur = judgeColor(this.grid.cells, this.colorKeys, this.zones, order.glaze);
    this.round.cake.glaze = { cells: Uint8Array.from(this.grid.cells), size: GRID, colorKeys: [...this.colorKeys] };
    goNext(this);
  }
}
