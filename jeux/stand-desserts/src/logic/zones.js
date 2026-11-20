function extremeColumns(mask, size) {
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % size;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  return maxX < minX ? null : { minX, maxX };
}

// Equal-area band edges (Glaçage N3): the n-1 column boundaries (integers, cell x units) where
// the cells counted column by column, left to right, come nearest to k/n of the silhouette. Each
// band then holds 1/n of the cells within one column's count; edges are strictly increasing.
function areaEdges(mask, size, n, ext) {
  const cols = new Array(size).fill(0);
  let total = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    cols[i % size]++;
    total++;
  }
  const edges = [];
  let acc = 0; // cells left of column x
  let x = ext.minX;
  for (let k = 1; k < n; k++) {
    const target = (total * k) / n;
    const lo = (edges[edges.length - 1] ?? ext.minX) + 1; // every band keeps at least one column
    const hi = ext.maxX - (n - 1 - k); // ...and leaves one to each band after it
    while (x < lo) acc += cols[x++];
    while (x < hi && Math.abs(acc + cols[x] - target) <= Math.abs(acc - target)) acc += cols[x++];
    edges.push(x);
  }
  return edges;
}

/**
 * zoneEdges(mask, size, n, {equalArea = false}) -> number[]
 * The n-1 band boundaries in cell x units (a band starts there). Equal width by default (Glaçage
 * N1-N2: the silhouette's width cut in n); `equalArea` (Glaçage N3, order.equalArea): each band
 * covers 1/n of the silhouette's cells (within one column), so tiers and quarts are real parts.
 */
export function zoneEdges(mask, size, n, { equalArea = false } = {}) {
  const ext = extremeColumns(mask, size);
  if (!ext || n <= 1) return [];
  if (equalArea) return areaEdges(mask, size, n, ext);
  const width = ext.maxX - ext.minX + 1;
  const edges = [];
  for (let k = 1; k < n; k++) edges.push(ext.minX + (width * k) / n);
  return edges;
}

/**
 * zoneMap(mask, size, n, {equalArea = false}) -> Int8Array (band index per cell, -1 outside)
 * Vertical bands left to right, cut at zoneEdges (same options): a cell is in the band whose
 * edges hold its left side.
 */
export function zoneMap(mask, size, n, { equalArea = false } = {}) {
  const out = new Int8Array(size * size).fill(-1);
  const ext = extremeColumns(mask, size);
  if (!ext) return out;
  const width = ext.maxX - ext.minX + 1;
  const edges = equalArea ? zoneEdges(mask, size, n, { equalArea }) : null;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % size;
    if (edges) {
      let z = 0;
      while (z < edges.length && x >= edges[z]) z++;
      out[i] = z;
    } else out[i] = Math.min(n - 1, Math.floor(((x - ext.minX) * n) / width));
  }
  return out;
}

// The band options of an order: equal areas when it says so (Glaçage N3), else equal widths.
export const bandOptions = order => ({ equalArea: order?.equalArea === true });

// Topping anchors in cell units, laid out symmetrically about the mask's vertical axis (the
// centre of its x-extent): mirrored pairs, plus one point on the axis for an odd count. A pair
// needs both cells inside the mask; points that cannot be paired (asymmetric silhouettes) are
// placed one by one. Deterministic; the minimum distance is relaxed down to 0 if it does not fit.
export function layoutToppings(mask, size, count, minDist = 9) {
  const ext = extremeColumns(mask, size);
  if (!ext || count <= 0) return [];
  const axis = (ext.minX + ext.maxX + 1) / 2;
  const cells = [];
  let sy = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % size;
    const y = Math.floor(i / size);
    cells.push({ u: x + 0.5, v: y + 0.5, mirror: mask[y * size + (ext.minX + ext.maxX - x)] === 1 });
    sy += y + 0.5;
  }
  const want = Math.min(count, cells.length);
  const cy = sy / cells.length;
  const inside = (u, v) => mask[Math.floor(v) * size + Math.floor(u)] === 1;
  const mir = p => ({ u: 2 * axis - p.u, v: p.v });
  const d = (a, b) => Math.hypot(a.u - b.u, a.v - b.v);
  const halves = cells.filter(c => c.mirror && c.u < axis - 1e-9);
  const onAxis = [];
  for (const c of cells) if (c.mirror && Math.abs(c.u - axis) < 0.5 + 1e-9 && inside(axis, c.v)) onAxis.push({ u: axis, v: c.v });
  const wantPairs = Math.floor(want / 2);
  const wantAxis = want % 2;
  const halfW = (ext.maxX - ext.minX + 1) / 2;

  const placePairs = (pts, md) => {
    let placed = 0;
    for (let k = 0; k < wantPairs; k++) {
      let best = null;
      let bs = -Infinity;
      for (const c of halves) {
        const m = mir(c);
        let s = 2 * (axis - c.u);
        for (const q of pts) s = Math.min(s, d(c, q), d(m, q));
        const rank = pts.length ? s : -Math.abs(c.v - cy) * 2 - Math.abs(axis - c.u - 0.6 * halfW); // first pair: mid-height row
        if (best === null || rank > bs) { best = c; bs = rank; }
      }
      if (!best) break;
      let s = 2 * (axis - best.u);
      for (const q of pts) s = Math.min(s, d(best, q), d(mir(best), q));
      if (pts.length && s < md) break;
      pts.push({ u: best.u, v: best.v }, mir(best));
      placed++;
    }
    return placed;
  };
  // With every pair allowed (md 0), how many pairs does this silhouette hold?
  const feasible = (() => {
    const pts = wantAxis && onAxis.length ? [onAxis[0]] : [];
    return placePairs(pts, 0);
  })();
  const needSingles = feasible < wantPairs;

  for (let md = minDist; md >= 0; md--) {
    const pts = [];
    if (wantAxis && onAxis.length) {
      let a = onAxis[0];
      for (const c of onAxis) if (Math.abs(c.v - cy) < Math.abs(a.v - cy)) a = c;
      pts.push(a); // the axis point sits at mid-height
    }
    const placed = placePairs(pts, md);
    if (placed < wantPairs && !needSingles) continue;
    // whatever could not be paired: single points, farthest from the ones already placed
    while (pts.length < want) {
      let best = null;
      let bd = -1;
      for (const c of cells) {
        let s = Infinity;
        for (const q of pts) s = Math.min(s, d(c, q));
        if (!pts.length) s = -Math.hypot(c.u - axis, c.v - cy);
        if (s > bd) { bd = s; best = c; }
      }
      if (!best || (pts.length && (bd < md || bd <= 0))) break;
      pts.push({ u: best.u, v: best.v });
    }
    if (pts.length >= want) return pts.slice(0, want).map(p => ({ u: p.u, v: p.v }));
  }
  return [];
}
