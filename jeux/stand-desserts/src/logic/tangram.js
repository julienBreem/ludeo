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
 * cutTangram(mask, size, shape, rng) -> Array<{cells: number[], polygon: [u,v][], rotation}> | null
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
    return groups.map(cells => ({
      cells,
      polygon: outline(cells, size),
      rotation: rng() < 0.4 ? 0 : ROTATIONS[1 + Math.floor(rng() * 3)],
    }));
  }
  return null;
}
