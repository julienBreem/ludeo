// Toppings N2: the ring of slots on the cake's top face, fitted to the shape's silhouette.
// The illustrator's ring (8 slots of 80 frame units on a circle of radius 110) only fits the
// round and square cakes. For any mask, the ring follows the silhouette, inset: the shape is shrunk
// by `inset` (cells nearer than that to the outside are dropped), then from a centre deep inside
// it a ray in every direction stops where the shrunk shape ends (and never beyond MAX_RADIUS); the
// slots are spread at equal steps along that closed curve, the first one just right of the top,
// clockwise. On a shape that is mirror-symmetric left / right the slots are too.
// Pure: masks are GRID x GRID arrays (1 = inside), positions are frame units around the cake centre
// (the frame is FRAME units wide, its centre is the cake centre), top-down (before any 3/4 squash).

export const SLOT_SIZE = 80; // a slot's width in frame units when there is room (96 px on a 480 px cake)
export const MIN_SLOT_SIZE = 60; // slots are never drawn smaller
// A slot's marker reaches this many times its size from edge to edge at most: the dotted ring is
// 0.94 of the art, and the next empty slot breathes up to 1.14 (ToppingsScene PULSE); with a
// little air between them. The size is at most the gap between two slots over this.
export const SLOT_REACH = 1.15;
export const MAX_RADIUS = 112; // frame units: the ring never goes further from its centre
// Frame units kept between a slot centre and the outline, deepest first (the toppings then stay on
// the cake); a ring nearer the edge is taken only when it spreads the slots clearly more.
const INSETS = [34, 30, 26, 22, 18, 14, 10];
const RAYS = 720; // rays around the centre (half a degree apart)
const STEP = 0.05; // ray marching step, in cells
const GAP_SLACK = 4; // frame units of gap given up for a ring further inside the outline
const SYMMETRY = 0.95; // share of cells mirrored inside for a mask to count as symmetric

const at = (mask, grid, u, v) => {
  const x = Math.floor(u);
  const y = Math.floor(v);
  return x >= 0 && y >= 0 && x < grid && y < grid && mask[y * grid + x] === 1;
};

// Per cell, the distance (cells) from its centre to the nearest outside cell's centre, minus half
// a cell: about the distance to the outline (0 outside).
function depthMap(mask, grid) {
  const edge = [];
  for (let y = -1; y <= grid; y++) {
    for (let x = -1; x <= grid; x++) {
      if (at(mask, grid, x + 0.5, y + 0.5)) continue;
      // an outside cell next to an inside one
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(mask, grid, x + dx + 0.5, y + dy + 0.5))) edge.push([x, y]);
    }
  }
  const depth = new Float32Array(grid * grid);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const u = i % grid;
    const v = Math.floor(i / grid);
    let d = Infinity;
    for (const [eu, ev] of edge) d = Math.min(d, (eu - u) ** 2 + (ev - v) ** 2);
    depth[i] = Math.sqrt(d) - 0.5;
  }
  return depth;
}

// A nearly symmetric silhouette (the art is symmetric, its 64x64 sampling may not quite be): only
// the cells whose mirror image is inside too, so that the ring comes out exactly symmetric. Other
// masks (the unicorn) are kept as they are.
function symmetric(mask, grid) {
  let minX = grid;
  let maxX = -1;
  let total = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    total++;
    minX = Math.min(minX, i % grid);
    maxX = Math.max(maxX, i % grid);
  }
  if (!total) return mask;
  const out = new Uint8Array(mask.length);
  let kept = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % grid;
    if (mask[i - x + (minX + maxX - x)]) { out[i] = 1; kept++; }
  }
  return kept >= total * SYMMETRY ? out : mask;
}

// The middle of the deepest cells, in cell units ({u, v}), or null for an empty mask.
function centreOf(depth, grid) {
  let best = 0;
  for (const d of depth) best = Math.max(best, d);
  if (best <= 0) return null;
  let su = 0;
  let sv = 0;
  let n = 0;
  for (let i = 0; i < depth.length; i++) {
    if (depth[i] < best - 0.75) continue;
    su += (i % grid) + 0.5;
    sv += Math.floor(i / grid) + 0.5;
    n++;
  }
  return { u: su / n, v: sv / n };
}

/**
 * ringCentre(mask, grid = 64) -> {u, v} | null
 * The middle of the deepest cells (largest distance to the outside), in cell units. On a
 * left / right symmetric mask the deepest cells are symmetric too, so the centre is on the axis.
 */
export function ringCentre(mask, grid = 64) {
  return centreOf(depthMap(mask, grid), grid);
}

// The shrunk shape's outline as a closed polyline (cell units), one point per ray, ray 0 pointing
// up and the rays going clockwise (screen y down).
function insetCurve(inner, grid, c, maxCells) {
  const pts = [];
  for (let j = 0; j < RAYS; j++) {
    const a = -Math.PI / 2 + (2 * Math.PI * j) / RAYS;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let t = 0;
    while (t + STEP <= maxCells && at(inner, grid, c.u + dx * (t + STEP), c.v + dy * (t + STEP))) t += STEP;
    pts.push({ u: c.u + dx * t, v: c.v + dy * t });
  }
  return pts;
}

// n points at equal steps along the closed polyline, the first half a step after point 0. A point
// that falls off the shrunk shape (on a jump between two rays, past a notch) takes the nearer end
// of its segment.
function spread(pts, n, ok) {
  const seg = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return Math.hypot(q.u - p.u, q.v - p.v);
  });
  const total = seg.reduce((a, b) => a + b, 0);
  const out = [];
  let i = 0;
  let acc = 0; // arc length at the start of segment i
  for (let k = 0; k < n; k++) {
    const s = (total * (k + 0.5)) / n;
    while (i < seg.length - 1 && acc + seg[i] < s) { acc += seg[i]; i++; }
    const t = seg[i] ? (s - acc) / seg[i] : 0;
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const m = { u: p.u + (q.u - p.u) * t, v: p.v + (q.v - p.v) * t };
    out.push(ok(m) ? m : t < 0.5 ? { ...p } : { ...q });
  }
  return out;
}

const minGap = (pts) => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) m = Math.min(m, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  }
  return m;
};

/**
 * ringSlots(mask, n, {grid = 64, frame = 400}) -> {slots: [{x, y}], size, centre: {x, y}, inset}
 * n slot centres (frame units around the frame centre, top-down), clockwise from just right of the
 * top, all inside the mask, about `inset` frame units or more from its outline. `size` is the slot
 * width to draw: SLOT_SIZE when there is room, else the smallest gap between two slots over
 * SLOT_REACH (so markers never touch, even breathing), at least MIN_SLOT_SIZE. The inset is the largest one of INSETS that leaves SLOT_SIZE between slots,
 * or nearly the widest gap any inset gives (GAP_SLACK less). No slots for an empty mask.
 */
export function ringSlots(mask, n, { grid = 64, frame = 400 } = {}) {
  const cell = frame / grid;
  const m = symmetric(mask, grid);
  const depth = depthMap(m, grid);
  const c = centreOf(depth, grid);
  const toFrame = p => ({ x: p.u * cell - frame / 2, y: p.v * cell - frame / 2 });
  if (!c || n <= 0) return { slots: [], size: SLOT_SIZE, centre: c ? toFrame(c) : { x: 0, y: 0 }, inset: 0 };
  const rings = [];
  for (const inset of INSETS) {
    const inner = new Uint8Array(m.length);
    for (let i = 0; i < m.length; i++) inner[i] = depth[i] >= inset / cell ? 1 : 0;
    if (!at(inner, grid, c.u, c.v)) continue;
    const ok = p => at(inner, grid, p.u, p.v);
    const cells = spread(insetCurve(inner, grid, c, MAX_RADIUS / cell), n, ok);
    if (!cells.every(ok)) continue;
    const slots = cells.map(toFrame);
    rings.push({ slots, inset, gap: n > 1 ? minGap(slots) : Infinity });
  }
  if (!rings.length) return { slots: [], size: SLOT_SIZE, centre: toFrame(c), inset: 0 };
  // the deepest ring whose slots are nearly as far apart as they can be
  const widest = Math.max(...rings.map(r => r.gap));
  const best = rings.find(r => r.gap >= Math.min(SLOT_SIZE, widest - GAP_SLACK));
  const round = v => Math.round(v * 100) / 100;
  return {
    slots: best.slots.map(p => ({ x: round(p.x), y: round(p.y) })),
    size: Math.max(MIN_SLOT_SIZE, Math.min(SLOT_SIZE, Math.floor(best.gap / SLOT_REACH))),
    centre: toFrame(c),
    inset: best.inset,
  };
}
