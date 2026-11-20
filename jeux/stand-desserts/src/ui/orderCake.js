// The cake an order asks for, as a Cake that drawCake can show: golden, smooth dough, every glaze
// zone fully painted with its colour, and the ordered toppings spread over the top, well apart.
import { TOP_SQUASH } from '../config.js';
import { GRID } from '../logic/paint.js';
import { zoneMap, layoutToppings } from '../logic/zones.js';
import { shapeMask, shapeRing, cakeTexture, FRAME, TOPPING_SIZE } from './cakeView.js';

const CELL = FRAME / GRID; // frame units per grid cell
// Wanted gap between topping anchors, in cells of the 3/4 view (a standing topping is about
// 80 frame units wide and tall on screen, so anchors closer than that make them overlap).
const SPREAD = 12;
const GOOD = 10.5; // a gap this wide (about one topping's visible width) is enough
const ERODE = [6, 5, 4, 3, 2, 1, 0]; // keep topping centres this many cells inside the silhouette
const STAND_ORIGIN_Y = 0.8; // as cakeView: a standing topping stands on this point of its image

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
  let p = pts.map(q => ({ ...q }));
  for (let it = 0; it < 40; it++) {
    let moved = false;
    const prev = p;
    p = prev.map(q => ({ ...q })); // all points move from the same state, which keeps mirrored pairs mirrored
    for (let i = 0; i < p.length; i++) {
      let fx = 0;
      let fy = 0;
      for (let j = 0; j < p.length; j++) {
        if (i === j) continue;
        const dx = prev[i].u - prev[j].u;
        const dy = prev[i].v - prev[j].v;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < want) { fx += (dx / d) * (want - d) * 0.5; fy += (dy / d) * (want - d) * 0.5; }
      }
      if (!fx && !fy) continue;
      const nu = prev[i].u + fx;
      const nv = prev[i].v + fy;
      if (inside(nu, nv)) { p[i].u = nu; p[i].v = nv; moved = true; }
      else if (inside(nu, prev[i].v)) { p[i].u = nu; moved = true; }
      else if (inside(prev[i].u, nv)) { p[i].v = nv; moved = true; }
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

// One kind per spot, following the layout's symmetry: both points of a mirrored pair get the
// same kind, and a kind's odd one goes on the axis. With several odd kinds the leftovers fill the
// remaining spots in order (approximate symmetry).
export function assignKinds(mask, spots, toppings) {
  const ext = mask.length ? extremes(mask) : null;
  const ax = ext ? ((ext.minX + ext.maxX + 1) / 2) * CELL - FRAME / 2 : 0;
  const tol = CELL * 0.75;
  const axisIdx = [];
  const left = [];
  const right = [];
  spots.forEach((p, i) => {
    if (Math.abs(p.x - ax) <= tol) axisIdx.push(i);
    else (p.x < ax ? left : right).push(i);
  });
  const pairs = [];
  const used = new Set();
  for (const i of left) {
    let bj = -1;
    let bd = Infinity;
    for (const j of right) {
      if (used.has(j)) continue;
      const dd = Math.hypot(spots[j].x - (2 * ax - spots[i].x), spots[j].y - spots[i].y);
      if (dd < bd) { bd = dd; bj = j; }
    }
    if (bj >= 0 && bd <= tol * 2) { used.add(bj); pairs.push([i, bj]); } else axisIdx.push(i);
  }
  for (const j of right) if (!used.has(j)) axisIdx.push(j);
  pairs.sort((a, b) => spots[a[0]].y - spots[b[0]].y || a[0] - b[0]);
  const out = Array(spots.length).fill(null);
  const odd = [];
  let pi = 0;
  for (const t of toppings) {
    for (let k = 0; k < Math.floor(t.count / 2); k++) {
      const pr = pairs[pi++];
      if (pr) { out[pr[0]] = t.key; out[pr[1]] = t.key; } else odd.push(t.key, t.key);
    }
    if (t.count % 2) odd.push(t.key);
  }
  // odd ones: the axis first, then whatever is left
  const rest = [];
  axisIdx.sort((a, b) => a - b);
  for (const i of axisIdx) rest.push(i);
  for (; pi < pairs.length; pi++) rest.push(pairs[pi][0], pairs[pi][1]);
  rest.sort((a, b) => (axisIdx.includes(a) ? 0 : 1) - (axisIdx.includes(b) ? 0 : 1) || a - b);
  odd.forEach((key, n) => { if (rest[n] !== undefined) out[rest[n]] = key; });
  return out;
}

function extremes(mask) {
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % GRID;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  return { minX, maxX };
}

/**
 * idealCake(scene, order) -> Cake {dessert, shape, doughOk: true, bake: 'dore',
 *   glaze: {cells, size: GRID, colorKeys: order.glaze}, toppings: [{key, x, y}]}
 * Every silhouette cell is painted with its zone's colour (zone i -> value i + 1); toppings are
 * order.toppings expanded in order (each kind `count` times) onto well-spaced spots, or for a
 * motif order (Toppings N2) the whole motif on the shape's ring of slots.
 */
export function idealCake(scene, order) {
  const mask = shapeMask(scene, order.shape);
  const zones = zoneMap(mask, GRID, Math.max(1, order.glaze.length));
  const cells = new Uint8Array(GRID * GRID);
  for (let i = 0; i < cells.length; i++) if (zones[i] >= 0) cells[i] = zones[i] + 1;
  let spots;
  let keys;
  if (order.toppingMode === 'motif' && order.motif) {
    spots = shapeRing(scene, order.shape, order.motif.slots).slots;
    keys = order.motif.sequence.slice(0, spots.length);
  } else {
    const total = order.toppings.reduce((n, t) => n + t.count, 0);
    spots = toppingSpots(mask, total);
    keys = assignKinds(mask, spots, order.toppings);
  }
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
  const ring = order.toppingMode === 'motif' && order.motif ? `ring${order.motif.sequence.join('+')}` : '';
  return [order.dessert, order.shape, order.glaze.join('+'), order.toppings.map(t => `${t.key}${t.count}`).join('+') + ring].join('-');
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

// ---- geometry of the order picture (Commande N1 labels) ---------------------------------------
const SIDE_DEPTH = 64; // the 3/4 side band continues this far below the squashed top face
const STAND_UP = TOPPING_SIZE * STAND_ORIGIN_Y; // a standing topping rises this far above its spot
const STAND_DOWN = TOPPING_SIZE * (1 - STAND_ORIGIN_Y);

/**
 * orderGeometry(scene, order) -> {bbox: {left, right, top, bottom}, shape: {x, y},
 *   zones: Array<{x, y, cells: number[]}>, toppings: Array<{x, y, spots: Array<{x, y}>}>}
 * In frame units around the cake centre, as the cake shows in 3/4 (orderCakeKey's picture):
 * bbox holds the whole cake (side band and standing toppings included); shape is a point on the
 * outline's right edge; zones[i] a point on the top face just behind its front edge, moved to the
 * nearest cell of the zone that no topping covers when a topping stands there (so a colour's dot
 * never seems to name a topping), and the zone's grid cells; toppings[i] (per order.toppings entry) the middle of the back-most topping
 * of that kind, with every spot of that kind (standing points).
 */
export function orderGeometry(scene, order) {
  const mask = shapeMask(scene, order.shape);
  const n = Math.max(1, order.glaze.length);
  const zones = zoneMap(mask, GRID, n);
  const fx = u => u * CELL - FRAME / 2;
  const fy = v => (v * CELL - FRAME / 2) * TOP_SQUASH;
  let minX = GRID; let maxX = -1; let minY = GRID; let maxY = -1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % GRID; const y = Math.floor(i / GRID);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const bbox = { left: fx(minX), right: fx(maxX + 1), top: fy(minY), bottom: fy(maxY + 1) + SIDE_DEPTH };
  // right edge of the outline: the middle of the rightmost column
  const rows = [];
  for (let y = 0; y < GRID; y++) if (mask[y * GRID + maxX]) rows.push(y);
  const midRow = rows.length ? rows[Math.floor(rows.length / 2)] : GRID / 2;
  const shape = { x: fx(maxX + 1) - CELL * 0.5, y: fy(midRow + 0.5) };
  const cake = idealCake(scene, order);
  // a frame point under a standing topping (its picture, with a margin for the dot)
  const DOT_MARGIN = 10;
  const covered = (x, y) => cake.toppings.some((p) => {
    const py = p.y * TOP_SQUASH;
    return Math.abs(x - p.x) < TOPPING_SIZE / 2 + DOT_MARGIN && y > py - STAND_UP - DOT_MARGIN && y < py + STAND_DOWN + DOT_MARGIN;
  });
  const zoneOut = [];
  for (let z = 0; z < order.glaze.length; z++) {
    const cells = [];
    let sx = 0;
    for (let i = 0; i < zones.length; i++) if (zones[i] === z) { cells.push(i); sx += i % GRID; }
    const col = cells.length ? Math.round(sx / cells.length) : GRID / 2;
    let row = -1; let top = GRID;
    for (const i of cells) {
      if (i % GRID !== col) continue;
      const y = Math.floor(i / GRID);
      row = Math.max(row, y); top = Math.min(top, y);
    }
    if (row < 0) { row = GRID / 2; top = row; }
    // a little behind the front edge, never past the zone's middle
    const v = Math.max((top + row + 1) / 2, row + 1 - 4);
    let point = { x: fx(col + 0.5), y: fy(v) };
    if (covered(point.x, point.y)) {
      let best = null;
      for (const i of cells) {
        const q = { x: fx((i % GRID) + 0.5), y: fy(Math.floor(i / GRID) + 0.5) };
        if (covered(q.x, q.y)) continue;
        const d = (q.x - point.x) ** 2 + (q.y - point.y) ** 2;
        if (!best || d < best.d) best = { ...q, d };
      }
      if (best) point = { x: best.x, y: best.y };
    }
    zoneOut.push({ ...point, cells });
  }
  const toppings = order.toppings.map(t => {
    const spots = cake.toppings.filter(p => p.key === t.key).map(p => ({ x: p.x, y: p.y * TOP_SQUASH }));
    let best = spots[0] ?? { x: 0, y: 0 };
    for (const p of spots) if (p.y < best.y) best = p;
    return { x: best.x, y: best.y - TOPPING_SIZE * 0.42, spots };
  });
  for (const p of cake.toppings) {
    const y = p.y * TOP_SQUASH;
    bbox.left = Math.min(bbox.left, p.x - TOPPING_SIZE / 2);
    bbox.right = Math.max(bbox.right, p.x + TOPPING_SIZE / 2);
    bbox.top = Math.min(bbox.top, y - STAND_UP);
    bbox.bottom = Math.max(bbox.bottom, y + STAND_DOWN);
  }
  return { bbox, shape, zones: zoneOut, toppings };
}
