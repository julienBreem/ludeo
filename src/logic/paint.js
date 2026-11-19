export const GRID = 64;
export const BRUSH_RADIUS = 4;

export function maskFromAlpha(rgba, w, h, size = GRID) {
  const mask = new Uint8Array(size * size);
  for (let cy = 0; cy < size; cy++) {
    const py = Math.min(h - 1, Math.floor(((cy + 0.5) * h) / size));
    for (let cx = 0; cx < size; cx++) {
      const px = Math.min(w - 1, Math.floor(((cx + 0.5) * w) / size));
      mask[cy * size + cx] = rgba[(py * w + px) * 4 + 3] > 127 ? 1 : 0;
    }
  }
  return mask;
}

export function createPaintGrid(mask, size = GRID) {
  const cells = new Uint8Array(size * size);
  let total = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) total++;
  return {
    cells,
    paint(u, v, colorIdx, radius = BRUSH_RADIUS) {
      const x0 = Math.max(0, Math.floor(u - radius));
      const x1 = Math.min(size - 1, Math.ceil(u + radius));
      const y0 = Math.max(0, Math.floor(v - radius));
      const y1 = Math.min(size - 1, Math.ceil(v + radius));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * size + x;
          if (!mask[i]) continue;
          const dx = x + 0.5 - u;
          const dy = y + 0.5 - v;
          if (dx * dx + dy * dy <= radius * radius) cells[i] = colorIdx;
        }
      }
    },
    coverage(colorKeys) {
      const counts = new Array(colorKeys.length).fill(0);
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        if (c > 0 && c <= colorKeys.length) counts[c - 1]++;
      }
      const out = {};
      colorKeys.forEach((k, i) => { out[k] = total ? counts[i] / total : 0; });
      return out;
    },
    clear() { cells.fill(0); },
  };
}
