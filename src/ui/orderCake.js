// The cake an order asks for, as a Cake that drawCake can show: golden, smooth dough, every glaze
// zone fully painted with its colour, and the ordered toppings spread over the top, well apart.
import { TOP_SQUASH } from '../config.js';
import { GRID } from '../logic/paint.js';
import { zoneMap, layoutToppings } from '../logic/zones.js';
import { shapeMask, cakeTexture, FRAME } from './cakeView.js';

const CELL = FRAME / GRID; // frame units per grid cell
// Wanted gap between topping anchors, in cells of the 3/4 view (a standing topping is about
// 80 frame units wide and tall on screen, so anchors closer than that make them overlap).
const SPREAD = 12;
const GOOD = 10.5; // a gap this wide (about one topping's visible width) is enough
const ERODE = [6, 5, 4, 3, 2, 1, 0]; // keep topping centres this many cells inside the silhouette

// Mask cells with every cell within r (Chebyshev) also inside.
function erode(mask, r) {
  if (r <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!mask[y * GRID + x]) continue;
      let ok = true;
      for (let dy = -r; dy <= r && ok; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= GRID || yy >= GRID || !mask[yy * GRID + xx]) { ok = false; break; }
        }
      }
      if (ok) out[y * GRID + x] = 1;
    }
  }
  return out;
}

// The silhouette as seen in 3/4 (rows squashed about the frame centre), on the same grid, so
// distances there are screen distances between standing toppings.
function squashed(mask) {
  const out = new Uint8Array(mask.length);
  const c = GRID / 2;
  for (let y = 0; y < GRID; y++) {
    const ry = Math.round(c + (y + 0.5 - c) / TOP_SQUASH - 0.5);
    if (ry < 0 || ry >= GRID) continue;
    for (let x = 0; x < GRID; x++) out[y * GRID + x] = mask[ry * GRID + x];
  }
  return out;
}

const minGap = pts => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].u - pts[j].u, pts[i].v - pts[j].v));
  }
  return m;
};

// Pushes points that are closer than `want` apart, never out of the mask (a few passes).
function relax(mask, pts, want) {
  const inside = (u, v) => {
    const x = Math.floor(u);
    const y = Math.floor(v);
    return x >= 0 && y >= 0 && x < GRID && y < GRID && mask[y * GRID + x] === 1;
  };
  const p = pts.map(q => ({ ...q }));
  for (let it = 0; it < 40; it++) {
    let moved = false;
    for (let i = 0; i < p.length; i++) {
      let fx = 0;
      let fy = 0;
      for (let j = 0; j < p.length; j++) {
        if (i === j) continue;
        const dx = p[i].u - p[j].u;
        const dy = p[i].v - p[j].v;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < want) { fx += (dx / d) * (want - d) * 0.5; fy += (dy / d) * (want - d) * 0.5; }
      }
      if (!fx && !fy) continue;
      const nu = p[i].u + fx;
      const nv = p[i].v + fy;
      if (inside(nu, nv)) { p[i].u = nu; p[i].v = nv; moved = true; }
      else if (inside(nu, p[i].v)) { p[i].u = nu; moved = true; }
      else if (inside(p[i].u, nv)) { p[i].v = nv; moved = true; }
    }
    if (!moved) break;
  }
  return minGap(p) >= minGap(pts) ? p : pts;
}

// Topping spots in frame units (top-down, centre-relative), laid out in the 3/4 view: from the
// most eroded mask down (toppings well inside the rim first), layoutToppings then a relaxation
// pass; the first layout with a GOOD gap wins, else the widest gap found.
export function toppingSpots(mask, count) {
  if (count <= 0) return [];
  let best = [];
  let bestGap = -1;
  for (const r of ERODE) {
    const m = squashed(erode(mask, r));
    let pts = layoutToppings(m, GRID, count, SPREAD);
    if (pts.length < count) continue;
    pts = relax(m, pts, SPREAD);
    const gap = count > 1 ? minGap(pts) : Infinity;
    if (gap > bestGap + 0.5) { best = pts; bestGap = gap; }
    if (gap >= GOOD) break;
  }
  if (!best.length) best = layoutToppings(squashed(mask), GRID, count, SPREAD);
  const c = GRID / 2;
  return best.map(p => ({
    x: p.u * CELL - FRAME / 2,
    y: (c + (p.v - c) / TOP_SQUASH) * CELL - FRAME / 2,
  }));
}

/**
 * idealCake(scene, order) -> Cake {dessert, shape, doughOk: true, bake: 'dore',
 *   glaze: {cells, size: GRID, colorKeys: order.glaze}, toppings: [{key, x, y}]}
 * Every silhouette cell is painted with its zone's colour (zone i -> value i + 1); toppings are
 * order.toppings expanded in order (each kind `count` times) onto well-spaced spots.
 */
export function idealCake(scene, order) {
  const mask = shapeMask(scene, order.shape);
  const zones = zoneMap(mask, GRID, Math.max(1, order.glaze.length));
  const cells = new Uint8Array(GRID * GRID);
  for (let i = 0; i < cells.length; i++) if (zones[i] >= 0) cells[i] = zones[i] + 1;
  const keys = order.toppings.flatMap(t => Array(t.count).fill(t.key));
  const spots = toppingSpots(mask, keys.length);
  return {
    dessert: order.dessert,
    shape: order.shape,
    doughOk: true,
    bake: 'dore',
    glaze: { cells, size: GRID, colorKeys: [...order.glaze] },
    toppings: spots.map((p, i) => ({ key: keys[i], x: p.x, y: p.y })),
  };
}

// ---- cached picture of an order --------------------------------------------------------------
export const ORDER_PX = 460; // the order texture's width (the Stand bubble shows it 1:1)
let lastSig = null;

export function orderSig(order) {
  return [order.dessert, order.shape, order.glaze.join('+'), order.toppings.map(t => `${t.key}${t.count}`).join('+')].join('-');
}

// One mask-free texture per order, made on first use and shared by the bubble and the strip.
// The previous order's textures (picture and highlights) are dropped when a new order shows up.
export function orderCakeKey(scene, order) {
  const sig = orderSig(order);
  const key = `order-cake-${sig}`;
  if (lastSig && lastSig !== sig) {
    for (const k of scene.textures.getTextureKeys()) {
      if (k.startsWith(`order-cake-${lastSig}`) || k.startsWith(`order-hl-${lastSig}`)) scene.textures.remove(k);
    }
  }
  lastSig = sig;
  if (!scene.textures.exists(key)) cakeTexture(scene, key, idealCake(scene, order), { size: ORDER_PX });
  return key;
}
