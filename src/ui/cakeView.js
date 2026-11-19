// Draws the cake being built (Round.cake). All cake textures share one 400x400 frame whose
// centre is the cake centre; the returned container is scaled by size / 400, so every child
// position below is in frame units relative to the centre.
import { COLOR_HEX, BAKE_TINT, TOP_SQUASH, BATTER } from '../config.js';
import { GREEN_MIN, GREEN_MAX } from '../logic/bake.js';
import { maskFromAlpha, GRID } from '../logic/paint.js';

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
 * Extras on the returned container: .top (top-face container), .glaze (Graphics),
 * .side, .moldBack, .moldFront, .line, .maskImage (images or null; maskImage is the top face's
 * BitmapMask source), .standing (3/4 standing topping images), .setBakeGauge(g), .setGlaze(glaze).
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
  c.standing = [];

  if (mold) {
    c.moldBack = scene.add.image(0, 0, `mold-${shape}-back`);
    c.add(c.moldBack);
  } else if (threeQ && shape) {
    c.side = scene.add.image(0, 0, `shape-${shape}-side`).setTint(tint);
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

  c.setBakeGauge = (g) => {
    const t = bakeTint(g);
    dessert?.setTint(t);
    c.side?.setTint(t);
    return c;
  };
  c.setGlaze = (glaze) => {
    if (c.glaze) drawGlaze(c.glaze, glaze);
    return c;
  };
  return c;
}
