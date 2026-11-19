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

export function layoutToppings(mask, size, count, minDist = 9) {
  const cells = [];
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const x = (i % size) + 0.5;
    const y = Math.floor(i / size) + 0.5;
    cells.push({ u: x, v: y });
    sx += x;
    sy += y;
  }
  if (!cells.length || count <= 0) return [];
  const want = Math.min(count, cells.length);
  const cx = sx / cells.length;
  const cy = sy / cells.length;
  let start = cells[0];
  let best = Infinity;
  for (const c of cells) {
    const d = (c.u - cx) ** 2 + (c.v - cy) ** 2;
    if (d < best) { best = d; start = c; }
  }
  for (let md = minDist; md >= 0; md--) {
    const pts = [start];
    const near = cells.map(c => Math.hypot(c.u - start.u, c.v - start.v));
    while (pts.length < want) {
      let bi = -1;
      let bd = -1;
      for (let i = 0; i < cells.length; i++) {
        if (near[i] > bd) { bd = near[i]; bi = i; }
      }
      if (bd < md || bd <= 0) break;
      const p = cells[bi];
      pts.push(p);
      for (let i = 0; i < cells.length; i++) {
        near[i] = Math.min(near[i], Math.hypot(cells[i].u - p.u, cells[i].v - p.v));
      }
    }
    if (pts.length >= want) return pts.map(p => ({ u: p.u, v: p.v }));
  }
  return [];
}
