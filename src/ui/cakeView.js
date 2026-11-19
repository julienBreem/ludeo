// Draws the cake being built (Round.cake). All cake textures share one 400x400 frame whose
// centre is the cake centre; the returned container is scaled by size / 400, so every child
// position below is in frame units relative to the centre.
import { COLOR_HEX, BAKE_TINT, TOP_SQUASH, BATTER } from '../config.js';
import { GREEN_MIN, GREEN_MAX } from '../logic/bake.js';
import { maskFromAlpha, GRID } from '../logic/paint.js';
import { crumbs } from './fx.js';

export const FRAME = 400;
export const TOPPING_SIZE = 80; // display size of one topping, in frame units
const BATTER_RADIUS = 160;
const STAND_ORIGIN_Y = 0.8; // 3/4 view: toppings stand on this point of their image

// gauge -> tint keyframes: raw, pale while under-baked, dore across the green window, then brule.
const BAKE_STOPS = [
  [0, BAKE_TINT.raw],
  [GREEN_MIN * 0.66, BAKE_TINT.pale],
  [GREEN_MIN, BAKE_TINT.dore],
  [GREEN_MAX, BAKE_TINT.dore],
  [1, BAKE_TINT.brule],
];

function lerpColor(a, b, t) {
  const ch = (c, s) => (c >> s) & 0xff;
  const mix = s => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

// Tint for a bake gauge (0..1) or a bake state ('pale'|'dore'|'brule'|null = raw).
export function bakeTint(gaugeOrState) {
  if (typeof gaugeOrState !== 'number') return BAKE_TINT[gaugeOrState ?? 'raw'] ?? BAKE_TINT.raw;
  const g = Math.min(1, Math.max(0, gaugeOrState));
  for (let i = 1; i < BAKE_STOPS.length; i++) {
    const [g1, c1] = BAKE_STOPS[i];
    const [g0, c0] = BAKE_STOPS[i - 1];
    if (g <= g1) return lerpColor(c0, c1, g1 === g0 ? 1 : (g - g0) / (g1 - g0));
  }
  return BAKE_TINT.brule;
}

// 64x64 paint mask (1 = inside the silhouette) from the shape-<shape>-fill texture alpha.
const maskCache = new Map();
export function shapeMask(scene, shape) {
  if (maskCache.has(shape)) return maskCache.get(shape);
  const src = scene.textures.get(`shape-${shape}-fill`).getSourceImage();
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = maskFromAlpha(data, canvas.width, canvas.height, GRID);
  maskCache.set(shape, mask);
  return mask;
}

// 3/4 side band texture for a dessert and a shape: shape-<shape>-side underneath, then the flat
// side-pattern-<dessert> clipped by that side texture's alpha on top (nothing above it). Both
// take the same bake tint, so the composite is rendered once per pair into a canvas texture
// (no per-frame mask) and tinted as one image. Falls back to shape-<shape>-side alone while the
// pattern texture is missing.
export function sideKey(scene, dessert, shape) {
  const side = `shape-${shape}-side`;
  const pattern = `side-pattern-${dessert}`;
  if (!dessert || !scene.textures.exists(pattern)) return side;
  const key = `cake-side-${dessert}-${shape}`;
  if (scene.textures.exists(key)) return key;
  const sideImg = scene.textures.get(side).getSourceImage();
  const w = sideImg.width;
  const h = sideImg.height;
  const clip = document.createElement('canvas');
  clip.width = w;
  clip.height = h;
  const cctx = clip.getContext('2d');
  cctx.drawImage(scene.textures.get(pattern).getSourceImage(), 0, 0, w, h);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(sideImg, 0, 0);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.drawImage(sideImg, 0, 0);
  ctx.drawImage(clip, 0, 0);
  tex.refresh();
  return key;
}

// Tart crust rim (shape-<shape>-rim, already clipped to the shape): 64x64 grid cells it covers,
// from its alpha like shapeMask. All zeros while the texture is missing (not cached then).
const rimCache = new Map();
export function rimMask(scene, shape) {
  if (rimCache.has(shape)) return rimCache.get(shape);
  const key = `shape-${shape}-rim`;
  if (!scene.textures.exists(key)) return new Uint8Array(GRID * GRID);
  const src = scene.textures.get(key).getSourceImage();
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = maskFromAlpha(data, canvas.width, canvas.height, GRID);
  rimCache.set(shape, mask);
  return mask;
}

// Glaze cells -> one rect per painted cell, colour from glaze.colorKeys (cell value 1..n).
function drawGlaze(g, glaze) {
  g.clear();
  if (!glaze?.cells) return;
  const n = glaze.size ?? GRID;
  const cs = FRAME / n;
  const colors = (glaze.colorKeys ?? []).map(k => COLOR_HEX[k]);
  for (let i = 0; i < glaze.cells.length; i++) {
    const c = glaze.cells[i];
    if (!c || colors[c - 1] === undefined) continue;
    g.fillStyle(colors[c - 1], 1);
    g.fillRect((i % n) * cs - FRAME / 2, Math.floor(i / n) * cs - FRAME / 2, cs + 0.6, cs + 0.6);
  }
}

// Keeps the BitmapMask image on the masked container's world transform (Phaser renders a mask
// with its own transform, ignoring parent containers), so the cake can move, scale and tween.
function syncMask(scene, maskImage, target) {
  const tmp = new Phaser.GameObjects.Components.TransformMatrix();
  const parent = new Phaser.GameObjects.Components.TransformMatrix();
  const sync = () => {
    if (!target.active) return;
    const m = target.getWorldTransformMatrix(tmp, parent).decomposeMatrix();
    maskImage.setPosition(m.translateX, m.translateY);
    maskImage.setRotation(m.rotation);
    maskImage.setScale(m.scaleX, m.scaleY);
  };
  sync();
  scene.events.on('prerender', sync);
  target.once('destroy', () => {
    scene.events.off('prerender', sync);
    maskImage.destroy();
  });
}

/**
 * drawCake(scene, x, y, cake, {size = 400, bakeGauge, view = '3q', inMold = false})
 * view 'top': top-down; '3q': side band + top face squashed by TOP_SQUASH, standing toppings.
 * inMold (with '3q'): mold back, squashed top face (no side band, no toppings), mold front.
 * Top container order: masked group (dessert, lumps, glaze) -> tart rim (tarte only, when
 * shape-<shape>-rim exists, bake-tinted) -> shape-<shape>-line -> toppings (top view).
 * Extras on the returned container: .top (top-face container), .glaze (Graphics), .rim,
 * .side, .moldBack, .moldFront, .line, .maskImage (images or null; maskImage is the top face's
 * BitmapMask source), .standing (3/4 standing topping images), .setBakeGauge(g), .setGlaze(glaze).
 * 3/4 out of the mould with a shape, also .eat(bites, {onDone, fromLeft}) and .nibble({onDone, fromLeft}) (see addEating).
 */
export function drawCake(scene, x, y, cake, { size = 400, bakeGauge, view = '3q', inMold = false } = {}) {
  const c = scene.add.container(x, y);
  c.setScale(size / FRAME);
  const shape = cake.shape;
  const threeQ = view === '3q';
  const mold = threeQ && inMold && shape;
  const tint = bakeTint(bakeGauge ?? cake.bake);

  c.side = null;
  c.moldBack = null;
  c.moldFront = null;
  c.glaze = null;
  c.line = null;
  c.maskImage = null;
  c.rim = null;
  c.standing = [];

  if (mold) {
    c.moldBack = scene.add.image(0, 0, `mold-${shape}-back`);
    c.add(c.moldBack);
  } else if (threeQ && shape) {
    c.side = scene.add.image(0, 0, sideKey(scene, cake.dessert, shape)).setTint(tint);
    c.add(c.side);
  }

  const top = scene.add.container(0, 0);
  if (threeQ) top.scaleY = TOP_SQUASH;
  c.add(top);
  c.top = top;

  let dessert = null;
  if (shape) {
    const masked = scene.add.container(0, 0);
    dessert = scene.add.image(0, 0, `dessert-${cake.dessert}`).setTint(tint);
    masked.add(dessert);
    if (cake.doughOk === false) masked.add(scene.add.image(0, 0, 'lumps'));
    c.glaze = scene.add.graphics();
    drawGlaze(c.glaze, cake.glaze);
    masked.add(c.glaze);
    top.add(masked);
    const rimKey = `shape-${shape}-rim`;
    if (cake.dessert === 'tarte' && scene.textures.exists(rimKey)) {
      c.rim = scene.add.image(0, 0, rimKey).setTint(tint);
      top.add(c.rim);
    }
    const maskImage = scene.make.image({ x: 0, y: 0, key: `shape-${shape}-fill`, add: false });
    masked.setMask(maskImage.createBitmapMask());
    syncMask(scene, maskImage, masked);
    c.maskImage = maskImage;
  } else {
    const batter = scene.add.graphics();
    batter.fillStyle(BATTER, 1).fillCircle(0, 0, BATTER_RADIUS);
    batter.fillStyle(0xffffff, 0.35).fillEllipse(-50, -60, 120, 60);
    top.add(batter);
    if (cake.doughOk === false) top.add(scene.add.image(0, 0, 'lumps'));
  }

  const toppings = (cake.toppings ?? []).map(t => {
    const img = scene.add.image(t.x, t.y, `topping-${t.key}`);
    img.setScale(TOPPING_SIZE / Math.max(img.width, img.height));
    return img;
  });
  if (!threeQ) toppings.forEach(t => top.add(t));
  if (shape) {
    c.line = scene.add.image(0, 0, `shape-${shape}-line`);
    top.add(c.line);
  }
  if (threeQ && !mold) {
    toppings
      .sort((a, b) => a.y - b.y)
      .forEach(t => {
        t.y *= TOP_SQUASH;
        t.setOrigin(0.5, STAND_ORIGIN_Y);
        c.add(t);
        c.standing.push(t);
      });
  } else if (mold) {
    toppings.forEach(t => t.destroy());
  }

  if (mold) {
    c.moldFront = scene.add.image(0, 0, `mold-${shape}-front`);
    c.add(c.moldFront);
  }

  const state = { cake, opts: { size, bakeGauge, view } };
  c.setBakeGauge = (g) => {
    state.opts.bakeGauge = g;
    const t = bakeTint(g);
    dessert?.setTint(t);
    c.side?.setTint(t);
    c.rim?.setTint(t);
    return c;
  };
  c.setGlaze = (glaze) => {
    state.cake = { ...state.cake, glaze };
    if (c.glaze) drawGlaze(c.glaze, glaze);
    return c;
  };
  if (threeQ && !mold && shape) addEating(scene, c, state);
  return c;
}

// ---- eating (3/4 view) ---------------------------------------------------------------------------
// On the first bite the whole cake (side band, top face, outline, standing toppings) is drawn once
// into a DynamicTexture and its parts are replaced by one image of it, so the cake has no mask
// left; each bite then erases a scalloped slice from that texture (right edge toward the left).
const BOX = 440; // snapshot square, frame units around the cake centre (holds standing toppings)
const BITES = 4;
const BITE_MS = 220; // the jaw sweeping through one quarter
const BITE_GAP = 380; // pause after each bite
const CRUMB_COLORS = [0xe0a65a, 0xc98a45, 0xf3d29a];
let eatSeq = 0;

function shapeExtent(mask) {
  let minX = GRID;
  let maxX = -1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % GRID;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const cs = FRAME / GRID;
  return maxX < 0 ? { left: -FRAME / 2, right: FRAME / 2 } : { left: minX * cs - FRAME / 2, right: (maxX + 1) * cs - FRAME / 2 };
}

// shape-<shape>-fill inverted (opaque outside the silhouette), used to erase around the top face.
function outsideKey(scene, shape) {
  const key = `shape-${shape}-outside`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(`shape-${shape}-fill`).getSourceImage();
  const tex = scene.textures.createCanvas(key, src.width, src.height);
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, src.width, src.height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  tex.refresh();
  return key;
}

// The 3/4 cake drawn once into a px x px DynamicTexture (k px per frame unit, cake centre at the
// texture centre), with the same layers as drawCake but no BitmapMask (masks do not render
// reliably into a DynamicTexture): the top face is drawn flat into its own texture and the
// outside of the silhouette erased from it, then squashed.
function snapshotCake(scene, key, cake, bakeGauge, k, px) {
  const shape = cake.shape;
  const tint = bakeTint(bakeGauge ?? cake.bake);
  const img = (k2, x = 0, y = 0) => scene.make.image({ x, y, key: k2, add: false });
  const fp = Math.ceil(FRAME * k);
  const topKey = `${key}-top`;
  const face = scene.textures.addDynamicTexture(topKey, fp, fp);
  const flat = scene.make.container({ x: fp / 2, y: fp / 2, add: false }).setScale(k);
  flat.add(img(`dessert-${cake.dessert}`).setTint(tint));
  if (cake.doughOk === false) flat.add(img('lumps'));
  const glaze = scene.make.graphics({ x: 0, y: 0 }, false);
  drawGlaze(glaze, cake.glaze);
  flat.add(glaze);
  face.draw(flat);
  const outside = scene.make.container({ x: fp / 2, y: fp / 2, add: false }).setScale(k);
  outside.add(img(outsideKey(scene, shape)));
  face.erase(outside);
  flat.destroy();
  outside.destroy();

  const all = scene.make.container({ x: px / 2, y: px / 2, add: false }).setScale(k);
  all.add(img(sideKey(scene, cake.dessert, shape)).setTint(tint));
  const top = scene.make.container({ x: 0, y: 0, add: false });
  top.scaleY = TOP_SQUASH;
  top.add(img(topKey).setScale(FRAME / fp));
  const rimKey = `shape-${shape}-rim`;
  if (cake.dessert === 'tarte' && scene.textures.exists(rimKey)) top.add(img(rimKey).setTint(tint));
  top.add(img(`shape-${shape}-line`));
  all.add(top);
  [...(cake.toppings ?? [])].sort((a, b) => a.y - b.y).forEach(t => {
    const ti = img(`topping-${t.key}`, t.x, t.y * TOP_SQUASH).setOrigin(0.5, STAND_ORIGIN_Y);
    ti.setScale(TOPPING_SIZE / Math.max(ti.width, ti.height));
    all.add(ti);
  });
  const tex = scene.textures.addDynamicTexture(key, px, px);
  tex.draw(all);
  all.destroy();
  scene.textures.remove(topKey);
  return tex;
}

/**
 * cakeTexture(scene, key, cake, {size = 400, bakeGauge}) -> key
 * The 3/4 cake (out of the mould, with standing toppings) rendered once into DynamicTexture
 * `key` (replaced if it exists): a square of CAKE_BOX * size / 400 px with the cake centre at its
 * centre, at `size` px per 400 frame units. Shown as an image it costs no mask per frame.
 */
export const CAKE_BOX = BOX;
export function cakeTexture(scene, key, cake, { size = FRAME, bakeGauge } = {}) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const k = size / FRAME;
  snapshotCake(scene, key, cake, bakeGauge, k, Math.ceil(BOX * k));
  return key;
}

function addEating(scene, c, state) {
  let snap = null; // { key, tex, k (texture px per frame unit), img, g }
  let eaten = 0;
  let busy = false;
  const ext = shapeExtent(shapeMask(scene, state.cake.shape));
  const quarter = (ext.right - ext.left) / BITES;
  const jaw = quarter * 0.55; // radius of the tooth scallops along the cut

  const takeSnapshot = () => {
    const m = c.getWorldTransformMatrix();
    const k = Math.max(0.2, Math.hypot(m.a, m.b));
    const px = Math.ceil(BOX * k);
    const key = `cake-eaten-${++eatSeq}`;
    const tex = snapshotCake(scene, key, state.cake, state.opts.bakeGauge, k, px);
    c.removeAll(true);
    c.top = c.side = c.line = c.glaze = c.maskImage = c.rim = null;
    c.standing = [];
    const img = scene.add.image(0, 0, key).setScale(1 / k);
    c.add(img);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    c.once('destroy', () => {
      g.destroy();
      img.destroy();
      if (scene.textures.exists(key)) scene.textures.remove(key);
    });
    snap = { key, tex, k, img, g };
    c.eatenImage = img;
  };

  // dir: +1 eats from the right edge toward the left (default), -1 from the left edge.
  let dir = 1;
  // Erases everything beyond x on the eaten side (frame units), with tooth scallops bulging
  // toward the part that is left.
  const eraseFrom = (x) => {
    const { g, tex, k } = snap;
    const toPx = v => (v + BOX / 2) * k;
    g.clear();
    g.fillStyle(0xffffff, 1);
    if (dir > 0) g.fillRect(toPx(x), 0, BOX * k, BOX * k);
    else g.fillRect(0, 0, toPx(x), BOX * k);
    const step = jaw * 1.3;
    for (let y = -BOX / 2 + jaw * 0.4; y < BOX / 2; y += step) {
      g.fillCircle(toPx(x + dir * jaw * 0.25), toPx(y), jaw * k);
    }
    tex.erase(g);
  };

  const crumbAt = (fx, fy, n) => {
    const p = c.getWorldTransformMatrix().transformPoint(fx, fy);
    crumbs(scene, p.x, p.y, CRUMB_COLORS, n);
  };

  const oneBite = (done) => {
    eaten++;
    const last = eaten >= BITES;
    const edge = dir > 0 ? ext.right : ext.left;
    const from = edge - dir * ((eaten - 1) * quarter - jaw * 1.4);
    const to = edge - dir * eaten * quarter;
    const sx = snap.img.scaleX;
    const sy = snap.img.scaleY;
    scene.tweens.addCounter({
      from, to, duration: BITE_MS, ease: 'Quad.easeOut',
      onUpdate: tw => { if (snap.img.active) eraseFrom(tw.getValue()); },
      onComplete: () => {
        if (!snap.img.active) return;
        if (last) snap.tex.clear();
        crumbAt(to + dir * jaw * 0.3, 20, 8);
        scene.tweens.add({
          targets: snap.img, scaleX: sx * 1.04, scaleY: sy * 0.96, duration: 90, yoyo: true,
          onComplete: () => { if (snap.img.active) snap.img.setScale(sx, sy); },
        });
        scene.time.delayedCall(BITE_GAP, done);
      },
    });
  };

  // eat(bites): plays `bites` more bites (total capped at 4); 4 eaten = nothing left.
  // eat(0) is nibble(). onDone runs once after the last bite. fromLeft: bites start at the
  // left edge (the eater stands on the left); taken from the first call.
  c.eat = (bites, { onDone, fromLeft = false } = {}) => {
    if (!snap && !busy) dir = fromLeft ? -1 : 1;
    const n = Math.max(0, Math.min(BITES - eaten, Math.floor(bites ?? 0)));
    if (n === 0 || busy) {
      if (!busy && (bites ?? 0) <= 0) return c.nibble({ onDone });
      onDone?.();
      return;
    }
    busy = true;
    if (!snap) takeSnapshot();
    let left = n;
    const next = () => {
      if (!c.active) return;
      if (left-- <= 0) { busy = false; onDone?.(); return; }
      oneBite(next);
    };
    next();
  };

  // A barely-there taste: the cake wobbles, two crumbs, nothing removed.
  c.nibble = ({ onDone, fromLeft } = {}) => {
    if (!snap && fromLeft !== undefined) dir = fromLeft ? -1 : 1;
    const a = c.angle;
    scene.tweens.add({
      targets: c, angle: a + 3, duration: 90, yoyo: true, repeat: 1, ease: 'Sine.easeInOut',
      onComplete: () => {
        if (!c.active) return;
        c.angle = a;
        crumbAt(dir > 0 ? ext.right - quarter * 0.3 : ext.left + quarter * 0.3, 10, 2);
        scene.time.delayedCall(BITE_GAP, () => onDone?.());
      },
    });
  };
  c.bitesEaten = () => eaten;
}
