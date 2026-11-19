// Moule (theme `geometrie`) drawings shared by the Mold scene and the Service recap: the moulds seen
// from above in their own colour, their corners (N2), the clue card (N2) and the tangram pieces (N3).
import { FRAME } from './cakeView.js';
import { cutSide, pieceMasks } from '../logic/tangram.js';

// Each mould's silicone colour (lot 2 art, mold-<k>-back/front): main and dark (outline, cut edges).
export const MOLD_COLORS = {
  rond: { main: 0xff5a36, dark: 0x802d1b },
  carre: { main: 0x00bfa0, dark: 0x006050 },
  coeur: { main: 0xff4f93, dark: 0x80284a },
  etoile: { main: 0xffb81f, dark: 0x805c10 },
  licorne: { main: 0x8a5cff, dark: 0x452e80 },
  triangle: { main: 0x3fcf4e, dark: 0x206827 },
  rectangle: { main: 0x3d7dff, dark: 0x1e3e80 },
  ovale: { main: 0x8f9db5, dark: 0x484e5a },
  losange: { main: 0xd44fe0, dark: 0x6a2870 },
  hexagone: { main: 0xb9743f, dark: 0x5c3a20 },
};
const DEFAULT_COLORS = { main: 0xb0bec5, dark: 0x455a64 };
export const moldColors = shape => MOLD_COLORS[shape] ?? DEFAULT_COLORS;

// What she can tap on a mould seen from above at N2 (frame px, top-down 400 frame, art-geometry.md):
// the corners of the polygons, the points of the fun shapes (the heart's tip, the star's five
// points, the unicorn's horn). Round shapes have none.
export const CORNERS = {
  triangle: [[200, 40], [370, 344], [30, 344]],
  carre: [[48, 48], [352, 48], [352, 352], [48, 352]],
  rectangle: [[32, 92], [368, 92], [368, 308], [32, 308]],
  losange: [[200, 34], [334, 200], [200, 366], [66, 200]],
  hexagone: [[116, 54.5], [284, 54.5], [368, 200], [284, 345.5], [116, 345.5], [32, 200]],
  coeur: [[200, 352]],
  etoile: [[200, 30], [366, 160], [300, 358], [100, 358], [34, 160]],
  licorne: [[278, 26]],
};
// The drawn corners are rounded: the glow sits this share of the way in towards the centre.
const CORNER_IN = 0.07;
export function cornerPoints(shape) {
  return (CORNERS[shape] ?? []).map(([x, y]) => [
    x + (FRAME / 2 - x) * CORNER_IN - FRAME / 2,
    y + (FRAME / 2 - y) * CORNER_IN - FRAME / 2,
  ]);
}

const GREY = 0xb8c0cc;
const GREY_DARK = 0x6b7684;
const FONT = 'Arial Black, Arial, sans-serif';

// Pictograms of the fun clues (no art): a point (heart, star) and a horn, in the neutral greys of
// pict-coin / pict-cote, 96 x 96. Drawn once per game.
export function ensureMoldPicts(scene) {
  const make = (key, draw) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, 96, 96);
    g.destroy();
  };
  make('pict-pointe', (g) => {
    g.fillStyle(GREY, 1).lineStyle(5, GREY_DARK, 1);
    g.fillTriangle(48, 10, 16, 86, 80, 86).strokeTriangle(48, 10, 16, 86, 80, 86);
    g.fillStyle(GREY_DARK, 1).fillCircle(48, 18, 10);
  });
  make('pict-corne', (g) => {
    g.fillStyle(GREY, 1).lineStyle(5, GREY_DARK, 1);
    g.fillTriangle(66, 8, 26, 84, 74, 84).strokeTriangle(66, 8, 26, 84, 74, 84);
    g.lineStyle(4, GREY_DARK, 1);
    for (const t of [0.3, 0.5, 0.7]) {
      const y = 8 + 76 * t;
      g.lineBetween(66 - 40 * t, y, 66 + 8 * t, y - 10);
    }
  });
}

const PICT = { corners: 'pict-coin', sides: 'pict-cote', equalSides: 'pict-cote', noCorner: 'pict-rond' };
const FUN_PICT = { pointe: 'pict-pointe', branches: 'pict-pointe', corne: 'pict-corne' };

// The clue in words, under its picture (« 3 côtés », « pas de coin », « une corne »).
export function clueWord(clue) {
  if (!clue) return '';
  switch (clue.kind) {
    case 'corners': return `${clue.n} coins`;
    case 'sides': return `${clue.n} côtés`;
    case 'equalSides': return `${clue.n} côtés pareils`;
    case 'noCorner': return 'pas de coin';
    case 'fun':
      if (clue.fun === 'corne') return 'une corne';
      return clue.n ? `${clue.n} pointes` : 'une pointe';
    default: return '';
  }
}

/**
 * clueRow(scene, clue, size) -> {items, w}
 * The clue as pictures, side by side and centred on x = 0, y = 0: the pictogram (a corner, a side,
 * no corner, a point, a horn), the number as a die (a face of size `size`), and « = » for equal
 * sides. No digit: the word under it (clueWord) is for the parent.
 */
export function clueRow(scene, clue, size) {
  ensureMoldPicts(scene);
  const gap = Math.round(size * 0.18);
  const items = [];
  const widths = [];
  const pict = clue.kind === 'fun' ? FUN_PICT[clue.fun] : PICT[clue.kind];
  if (pict) {
    items.push(scene.add.image(0, 0, pict).setDisplaySize(size, size));
    widths.push(size);
  }
  if (clue.n && clue.n <= 5) {
    items.push(scene.add.image(0, 0, `dice-${clue.n}`).setDisplaySize(size * 0.86, size * 0.86));
    widths.push(size * 0.86);
  } else if (clue.n) {
    // 6 (hexagone): a 5 and a 1, the way the dough shows numbers past 5
    for (const f of [5, clue.n - 5]) {
      items.push(scene.add.image(0, 0, `dice-${f}`).setDisplaySize(size * 0.7, size * 0.7));
      widths.push(size * 0.7);
    }
  }
  if (clue.kind === 'equalSides') {
    items.push(scene.add.text(0, 0, '=', { fontFamily: FONT, fontSize: `${Math.round(size * 0.8)}px`, color: '#222222' }).setOrigin(0.5));
    widths.push(size * 0.5);
  }
  const w = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  let x = -w / 2;
  items.forEach((it, i) => {
    it.x = x + widths[i] / 2;
    x += widths[i] + gap;
  });
  return { items, w };
}

/**
 * addSilhouette(scene, x, y, shape, size) -> Container
 * The mould seen from above: the shape's silhouette in the mould's colour, its outline on top.
 */
export function addSilhouette(scene, x, y, shape, size) {
  const c = scene.add.container(x, y);
  const k = size / FRAME;
  const { main, dark } = moldColors(shape);
  c.add(scene.add.image(0, 0, `shape-${shape}-fill`).setScale(k).setTint(main));
  c.add(scene.add.image(0, 0, `shape-${shape}-line`).setScale(k).setTint(dark));
  return c;
}

const hex = c => `#${c.toString(16).padStart(6, '0')}`;
let pieceSeq = 0;
let liveKeys = [];
const EDGE_PX = 3; // cut edges: a dark line this wide on each side of the cut
const FIT_STEP = 4; // pieceFits pictures: one point every 4 frame px (100 x 100)

/**
 * pieceTextures(scene, shape, pieces, size) -> {tex: Array<{key, cx, cy}>, masks}
 * One canvas texture per tangram piece (logic/tangram.js cutTangram, cut from a size x size mask):
 * the shape seen from above in the mould's colour with its outline, kept where cutSide() says the
 * point belongs to that piece (straight cut lines, drawn dark), cropped around the piece's cells
 * with one cell of margin on every side. (cx, cy) = the crop's centre in frame px (0..400), i.e.
 * where the piece's centre sits in the whole silhouette; the piece turns about it. The textures of
 * the previous exercise are removed (one exercise lives at a time, kept for the Service recap).
 * masks: the pieces as drawn (alpha > 1/2, one point every FIT_STEP px) for pieceFits().
 */
export function pieceTextures(scene, shape, pieces, size) {
  for (const k of liveKeys) if (scene.textures.exists(k)) scene.textures.remove(k);
  liveKeys = [];
  const S = FRAME;
  const base = document.createElement('canvas');
  base.width = S;
  base.height = S;
  const b = base.getContext('2d', { willReadFrequently: true });
  const { main, dark } = moldColors(shape);
  b.drawImage(scene.textures.get(`shape-${shape}-fill`).getSourceImage(), 0, 0, S, S);
  b.globalCompositeOperation = 'source-in';
  b.fillStyle = hex(main);
  b.fillRect(0, 0, S, S);
  b.globalCompositeOperation = 'source-over';
  b.drawImage(scene.textures.get(`shape-${shape}-line`).getSourceImage(), 0, 0, S, S);
  const src = b.getImageData(0, 0, S, S).data;
  const cell = S / size;
  const side = cutSide(pieces[0].cut);
  const owner = new Int8Array(S * S).fill(-1);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (src[(y * S + x) * 4 + 3] > 0) owner[y * S + x] = side((x + 0.5) / cell, (y + 0.5) / cell);
    }
  }
  const n = S / FIT_STEP;
  const fine = new Int8Array(n * n).fill(-1);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // the block's centre (px, py) is a pixel corner: its four pixels, so that the samples are
      // symmetric about the frame's centre like the art
      const px = x * FIT_STEP + FIT_STEP / 2;
      const py = y * FIT_STEP + FIT_STEP / 2;
      const al = (i, j) => src[(j * S + i) * 4 + 3];
      if (al(px - 1, py - 1) + al(px, py - 1) + al(px - 1, py) + al(px, py) <= 4 * 127) continue;
      // a point right on a cut line belongs to neither piece (both get the same share)
      const a = side((px - 1) / cell, (py - 1) / cell);
      const b = side((px + 1) / cell, (py + 1) / cell);
      const c = side((px + 1) / cell, (py - 1) / cell);
      const d = side((px - 1) / cell, (py + 1) / cell);
      if (a === b && b === c && c === d) fine[y * n + x] = a;
    }
  }
  const masks = pieceMasks(fine, n, pieces.length);
  const dr = (dark >> 16) & 0xff;
  const dg = (dark >> 8) & 0xff;
  const db = dark & 0xff;
  const seq = ++pieceSeq;
  const tex = pieces.map((p, i) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of p.cells) {
      const u = c % size, v = Math.floor(c / size);
      x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v);
    }
    const cx = ((x0 + x1 + 1) / 2) * cell;
    const cy = ((y0 + y1 + 1) / 2) * cell;
    const w = Math.ceil((x1 - x0 + 3) * cell);
    const h = Math.ceil((y1 - y0 + 3) * cell);
    const left = Math.round(cx - w / 2);
    const top = Math.round(cy - h / 2);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const out = ctx.createImageData(w, h);
    const at = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? -1 : owner[y * S + x]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = x + left;
        const sy = y + top;
        if (at(sx, sy) !== i) continue;
        const o = (y * w + x) * 4;
        const s = (sy * S + sx) * 4;
        let edge = false;
        for (const [dx, dy] of [[EDGE_PX, 0], [-EDGE_PX, 0], [0, EDGE_PX], [0, -EDGE_PX]]) {
          const n = at(sx + dx, sy + dy);
          if (n >= 0 && n !== i) edge = true;
        }
        if (edge) {
          out.data[o] = dr; out.data[o + 1] = dg; out.data[o + 2] = db; out.data[o + 3] = 255;
        } else {
          out.data[o] = src[s]; out.data[o + 1] = src[s + 1]; out.data[o + 2] = src[s + 2]; out.data[o + 3] = src[s + 3];
        }
      }
    }
    ctx.putImageData(out, 0, 0);
    const key = `tangram-${seq}-${i}`;
    scene.textures.addCanvas(key, canvas);
    liveKeys.push(key);
    return { key, cx: left + w / 2, cy: top + h / 2 };
  });
  return { tex, masks };
}
