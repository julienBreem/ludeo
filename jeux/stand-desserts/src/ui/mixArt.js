// Glaçage N2-N3 art: the mixing bowl, its liquid and the « mélange raté » splash. The SVGs
// (bowl-mix, bowl-mix-liquid, blob-rate; lot 3 art) may not be loaded yet: ensureMixTextures then
// draws simple stand-ins under the same keys and sizes (geometry: docs/superpowers/notes/art-geometry.md).
// Also the N3 rim graduations, which are drawn in code (no file).

export const BOWL_W = 360;
export const BOWL_H = 260;
// Inside opening of the bowl (bowl frame): where the liquid shows and a pot is poured.
export const BOWL_OPENING = { x: 180, y: 86, rx: 148, ry: 50 };
const OUT = 0x4a2c2a;

export function ensureMixTextures(scene) {
  const T = scene.textures;
  const make = (key, w, h, draw) => {
    if (T.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  make('bowl-mix', BOWL_W, BOWL_H, (g) => {
    // foot, body (a half ellipse under the rim), turquoise stripe, rim and dark opening
    g.fillStyle(0xd7dde3, 1).fillEllipse(180, 236, 150, 30);
    g.lineStyle(6, OUT, 1).strokeEllipse(180, 236, 150, 30);
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(8, 80);
    g.arc(180, 80, 172, Math.PI, 0, true);
    g.closePath();
    g.fillPath();
    g.lineStyle(6, OUT, 1).strokePath();
    g.lineStyle(18, 0x26c6da, 1);
    g.beginPath();
    g.arc(180, 80, 140, Math.PI * 0.86, Math.PI * 0.14, true);
    g.strokePath();
    g.fillStyle(0xffffff, 1).fillEllipse(180, 80, 352, 112);
    g.lineStyle(6, OUT, 1).strokeEllipse(180, 80, 352, 112);
    g.fillStyle(0xe3e8ee, 1).fillEllipse(180, 86, 296, 100);
    g.lineStyle(4, 0xb0bec5, 1).strokeEllipse(180, 86, 296, 100);
  });
  make('bowl-mix-liquid', BOWL_W, BOWL_H, (g) => {
    // white and grey only: a multiply tint gives the colour
    g.fillStyle(0xdedede, 1).fillEllipse(180, 98, 260, 70);
    g.fillStyle(0xffffff, 1).fillEllipse(180, 94, 240, 58);
    g.lineStyle(5, 0xe8e8e8, 1);
    g.beginPath();
    g.arc(170, 94, 46, Math.PI * 0.1, Math.PI * 1.3, false);
    g.strokePath();
  });
  make('blob-rate', 160, 160, (g) => {
    g.fillStyle(0x8a7d54, 1);
    g.fillCircle(80, 84, 50).fillCircle(46, 64, 26).fillCircle(116, 70, 24).fillCircle(60, 118, 22).fillCircle(108, 116, 20);
    g.fillCircle(24, 30, 9).fillCircle(140, 32, 8).fillCircle(140, 140, 7).fillCircle(18, 128, 6);
    g.lineStyle(7, 0x7b4f9e, 0.8).lineBetween(54, 78, 100, 70);
    g.lineStyle(7, 0x4f8a3a, 0.8).lineBetween(58, 98, 106, 92);
    g.lineStyle(7, 0xa0442c, 0.8).lineBetween(66, 116, 98, 110);
    g.lineStyle(5, OUT, 0.6).strokeCircle(80, 84, 50);
  });
}

/**
 * drawRimTicks(g, full, size, edges, frame, {inset = 9}) — the N3 graduations: at each band edge,
 * where the edge's column crosses the outline (top and bottom), a tick from `inset` frame units
 * inside the outline to 15 outside. Stroke 11 dark brown, round caps, with a white stroke 5 over
 * it (the colours of the dotted lines). No tick at the two ends of the width. `full` is the
 * silhouette mask (size x size), `edges` the band edges in cell x units (zones.js zoneEdges).
 */
export function drawRimTicks(g, full, size, edges, frame, { inset = 9 } = {}) {
  const cell = frame / size;
  const ticks = [];
  for (const e of edges) {
    const a = Math.max(0, Math.ceil(e) - 1);
    const b = Math.min(size - 1, Math.floor(e));
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < size; y++) {
      if (full[y * size + a] || full[y * size + b]) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    if (top < 0) continue;
    const x = e * cell - frame / 2;
    const yt = top * cell - frame / 2;
    const yb = (bottom + 1) * cell - frame / 2;
    ticks.push([x, yt - 15, x, yt + inset], [x, yb - inset, x, yb + 15]);
  }
  const stroke = (width, color) => {
    for (const [x1, y1, x2, y2] of ticks) {
      g.lineStyle(width, color, 1).lineBetween(x1, y1, x2, y2);
      g.fillStyle(color, 1).fillCircle(x1, y1, width / 2).fillCircle(x2, y2, width / 2); // round caps
    }
  };
  stroke(11, OUT);
  stroke(5, 0xffffff);
  return ticks;
}
