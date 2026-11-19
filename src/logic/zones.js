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

export function zoneMap(mask, size, n) {
  const out = new Int8Array(size * size).fill(-1);
  const ext = extremeColumns(mask, size);
  if (!ext) return out;
  const width = ext.maxX - ext.minX + 1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = i % size;
    out[i] = Math.min(n - 1, Math.floor(((x - ext.minX) * n) / width));
  }
  return out;
}

// Band boundaries in cell x units: the n-1 x values where a band starts.
export function zoneEdges(mask, size, n) {
  const ext = extremeColumns(mask, size);
  if (!ext) return [];
  const width = ext.maxX - ext.minX + 1;
  const edges = [];
  for (let k = 1; k < n; k++) edges.push(ext.minX + (width * k) / n);
  return edges;
}

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
