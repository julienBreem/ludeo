// Cuts a silhouette mask (size x size, 1 = inside) into 2-3 pieces by straight cuts through its
// centre. Pure; takes the mask as input. Pieces partition the mask exactly.
const ROTATIONS = [0, 90, 180, 270];

function bounds(mask, size) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % size, y = Math.floor(i / size);
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < x0 ? null : { x0, x1: x1 + 1, y0, y1: y1 + 1 };
}

// Outline of a cell set as a polygon in cell units (largest outer loop, collinear points removed).
export function outline(cells, size) {
  const edges = new Map(); // "x,y" -> [[x,y],...] directed edges
  const key = (x, y) => `${x},${y}`;
  const add = (a, b) => {
    const rev = edges.get(key(b[0], b[1]));
    const i = rev ? rev.findIndex(t => t[0] === a[0] && t[1] === a[1]) : -1;
    if (i >= 0) { rev.splice(i, 1); return; }
    const k = key(a[0], a[1]);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push(b);
  };
  for (const c of cells) {
    const x = c % size, y = Math.floor(c / size);
    add([x, y], [x + 1, y]); add([x + 1, y], [x + 1, y + 1]);
    add([x + 1, y + 1], [x, y + 1]); add([x, y + 1], [x, y]);
  }
  const loops = [];
  for (const [k, list] of edges) {
    while (list.length) {
      const start = k.split(',').map(Number);
      const loop = [start];
      let cur = list.pop();
      while (cur && !(cur[0] === start[0] && cur[1] === start[1])) {
        loop.push(cur);
        const nx = edges.get(key(cur[0], cur[1]));
        cur = nx && nx.length ? nx.pop() : null;
      }
      loops.push(loop);
    }
  }
  const area = l => Math.abs(l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  loops.sort((a, b) => area(b) - area(a));
  const l = loops[0] ?? [];
  return l.filter((p, i) => {
    const a = l[(i + l.length - 1) % l.length], b = l[(i + 1) % l.length];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
}

// Side function per cut kind: value < 0 / >= 0 decides which piece a cell centre falls in.
function cutFns(kind, bb, parts) {
  const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
  if (parts === 3) {
    const horiz = kind === 'h';
    const lo = horiz ? bb.y0 : bb.x0, hi = horiz ? bb.y1 : bb.x1;
    const t = (hi - lo) / 3;
    return (u, v) => { const w = horiz ? v : u; return w < lo + t ? 0 : w < lo + 2 * t ? 1 : 2; };
  }
  if (kind === 'v') return u => (u < cx ? 0 : 1);
  if (kind === 'h') return (u, v) => (v < cy ? 0 : 1);
  if (kind === 'd1') return (u, v) => (u - cx + (v - cy) < 0 ? 0 : 1);
  return (u, v) => (u - cx - (v - cy) < 0 ? 0 : 1);
}

/**
 * cutSide(cut) -> (u, v) -> piece index
 * The piece a point of the mask grid (continuous cell units, u right, v down) falls in, for the
 * `cut` a piece carries: the scene draws the pieces from the real shape texture with it, so the
 * cut edges are straight lines and not the cells' staircase.
 */
export function cutSide({ kind, parts, bb }) {
  return cutFns(kind, bb, parts);
}

/**
 * cutTangram(mask, size, shape, rng) -> Array<{cells: number[], polygon: [u,v][], rotation, cut, index}> | null
 * 2 pieces (vertical/horizontal cut through the centre; diagonal too for carre/losange); 3 pieces
 * (two parallel cuts) only for hexagone and rectangle, half of the time.
 */
export function cutTangram(mask, size, shape, rng = Math.random) {
  const bb = bounds(mask, size);
  if (!bb) return null;
  const three = (shape === 'hexagone' || shape === 'rectangle') && rng() < 0.5;
  const kinds = three ? ['v', 'h'] : (shape === 'carre' || shape === 'losange') ? ['v', 'h', 'd1', 'd2'] : ['v', 'h'];
  const start = Math.floor(rng() * kinds.length);
  const parts = three ? 3 : 2;
  for (let a = 0; a < kinds.length; a++) {
    const fn = cutFns(kinds[(start + a) % kinds.length], bb, parts);
    const groups = Array.from({ length: parts }, () => []);
    for (let i = 0; i < mask.length; i++) if (mask[i]) groups[fn((i % size) + 0.5, Math.floor(i / size) + 0.5)].push(i);
    if (groups.some(g => !g.length)) continue;
    const cut = { kind: kinds[(start + a) % kinds.length], parts, bb };
    return groups.map((cells, index) => ({
      cells,
      polygon: outline(cells, size),
      rotation: rng() < 0.4 ? 0 : ROTATIONS[1 + Math.floor(rng() * 3)],
      cut,
      index,
    }));
  }
  return null;
}

// A piece as a binary picture cropped to its bounding box: {w, h, set} (set = y * w + x of the
// points inside).
function crop(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const set = new Set();
  for (const [x, y] of points) set.add((y - y0) * w + (x - x0));
  return { w, h, set };
}

/**
 * pieceMasks(owner, n, count) -> Array<{w, h, set}>
 * owner: an n x n map (Int8Array or array) giving for each point the piece it belongs to (-1:
 * outside the shape, or right on a cut line), sampled finer than the cut grid so that the cut
 * lines are straight (the scene samples the real texture: rounded corners count). One cropped picture per piece 0..count-1.
 */
export function pieceMasks(owner, n, count) {
  const pts = Array.from({ length: count }, () => []);
  for (let i = 0; i < owner.length; i++) {
    const k = owner[i];
    if (k >= 0 && k < count) pts[k].push([i % n, Math.floor(i / n)]);
  }
  return pts.map(crop);
}

// The picture turned `turns` quarter turns clockwise (screen axes: x right, y down).
function turn(p, turns) {
  let { w, h, set } = p;
  for (let t = 0; t < turns; t++) {
    const next = new Set();
    for (const k of set) {
      const x = k % w, y = Math.floor(k / w);
      next.add(x * h + (h - 1 - y)); // (x, y) -> (h - 1 - y, x) in an h x w picture
    }
    [w, h, set] = [h, w, next];
  }
  return { w, h, set };
}

const SHIFT = 2; // points: pictures are compared at the best of these small offsets (rasterising)

// Share of points that differ between two pictures laid centred on each other, at the best small
// offset (a shape drawn half a pixel off, or a bounding box one point larger, is no difference).
function mismatch(a, b) {
  if (Math.abs(a.w - b.w) > 2 * SHIFT || Math.abs(a.h - b.h) > 2 * SHIFT) return 1;
  const ox = Math.floor((b.w - a.w) / 2), oy = Math.floor((b.h - a.h) / 2);
  let best = Infinity;
  for (let dy = -SHIFT; dy <= SHIFT; dy++) {
    for (let dx = -SHIFT; dx <= SHIFT; dx++) {
      let common = 0;
      for (const k of a.set) {
        const x = (k % a.w) + ox + dx, y = Math.floor(k / a.w) + oy + dy;
        if (x >= 0 && y >= 0 && x < b.w && y < b.h && b.set.has(y * b.w + x)) common++;
      }
      best = Math.min(best, a.set.size + b.set.size - 2 * common);
    }
  }
  return best / Math.max(a.set.size, b.set.size);
}

// Share of differing points still taken as "the same piece" (sampling at the edges). The art's
// rectangle turned upside down differs by its rounded corners (a half: about 4 %; a middle third
// against an outer one: about 3 %): it does not fit the other way round.
export const FIT_TOLERANCE = 0.02;

/**
 * pieceFits(masks, tolerance) -> fits[i][r] = indices j (r = 0..3 quarter turns clockwise)
 * masks: pieceMasks(). Piece i turned r quarter turns looks like piece j, so it may fill j's
 * place: a half of a square turned upside down is the other half. Every i fits its own place at
 * r = 0.
 */
export function pieceFits(masks, tolerance = FIT_TOLERANCE) {
  return masks.map((m, i) => [0, 1, 2, 3].map((r) => {
    const turned = turn(m, r);
    return masks.map((_, j) => j).filter(j => (r === 0 && j === i) || mismatch(turned, masks[j]) <= tolerance);
  }));
}
