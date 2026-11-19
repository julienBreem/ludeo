// Words of the order on screen (Commande N1-N3, the strip, the Service recap): label tags,
// category pictograms and flowing text whose pieces can be highlighted.
// The art (label-tag, icon-eye, pict-forme|couleur|topping) may be missing: ensureWordTextures
// then draws simple stand-ins under the same keys, with the same sizes and 9-slice insets.

export const WORD_FONT = 'Arial, Helvetica, sans-serif';
export const WORD_COLOR = '#1f2a44';
export const MARK = 0xffd54f; // highlight marker behind a word
export const TAG_SLICE = [26, 26, 26, 30]; // label-tag 9-slice insets: left, right, top, bottom
const TAG_PAD_X = 18; // label-tag text area x 18..182 of 200
const TAG_PAD_TOP = 7;
const TAG_PAD_BOTTOM = 13; // the tag's bottom shadow
export const TAG_MIN_H = 64;
const LINE = 0x6fa6d6;
const GREY = 0xb8c0cc;
const GREY_DARK = 0x6b7684;

export const pictKey = kind => `pict-${kind}`;
const NUMBER = /^(\d+|un|une|deux|trois|quatre|cinq|six)$/i;

// Stand-ins for the art that is not loaded (drawn once per game, kept by the texture manager).
export function ensureWordTextures(scene) {
  const T = scene.textures;
  const make = (key, w, h, draw) => {
    if (T.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  make('label-tag', 200, 64, (g) => {
    g.fillStyle(LINE, 1).fillRoundedRect(2, 8, 196, 54, 22);
    g.fillStyle(0xffffff, 1).fillRoundedRect(2, 2, 196, 54, 22);
    g.lineStyle(3, LINE, 1).strokeRoundedRect(3.5, 3.5, 193, 51, 21);
  });
  make('icon-eye', 160, 160, (g) => {
    g.fillStyle(0x0b4a70, 0.25).fillCircle(82, 86, 74);
    g.fillStyle(0xffc233, 1).fillCircle(80, 80, 74);
    g.lineStyle(5, 0x8a5a00, 1).strokeCircle(80, 80, 72);
    g.fillStyle(0xffffff, 1).fillEllipse(80, 82, 112, 64);
    g.lineStyle(5, 0x222222, 1).strokeEllipse(80, 82, 112, 64);
    g.fillStyle(0x29a8e0, 1).fillCircle(80, 82, 24);
    g.fillStyle(0x222222, 1).fillCircle(80, 82, 11);
    g.fillStyle(0xffffff, 1).fillCircle(87, 74, 6);
  });
  make(pictKey('forme'), 96, 96, (g) => {
    g.fillStyle(GREY, 1).lineStyle(5, GREY_DARK, 1);
    g.fillRoundedRect(10, 34, 52, 52, 8).strokeRoundedRect(10, 34, 52, 52, 8);
    g.fillCircle(62, 34, 24).strokeCircle(62, 34, 24);
  });
  make(pictKey('couleur'), 96, 96, (g) => {
    g.fillStyle(GREY, 1).lineStyle(5, GREY_DARK, 1);
    g.fillTriangle(48, 8, 22, 54, 74, 54);
    g.fillCircle(48, 60, 28).strokeCircle(48, 60, 28);
    g.lineBetween(48, 8, 22, 50).lineBetween(48, 8, 74, 50);
    g.fillStyle(0xffffff, 0.8).fillCircle(38, 56, 7);
  });
  make(pictKey('topping'), 96, 96, (g) => {
    g.lineStyle(5, GREY_DARK, 1).lineBetween(48, 52, 62, 12).lineBetween(62, 12, 76, 18);
    g.fillStyle(GREY, 1).fillCircle(46, 64, 24).strokeCircle(46, 64, 24);
    g.fillStyle(0xffffff, 0.8).fillCircle(38, 56, 7);
  });
}

export const wordStyle = (fontSize, extra = {}) => ({
  fontFamily: WORD_FONT, fontStyle: 'bold', fontSize: `${fontSize}px`, color: WORD_COLOR, ...extra,
});

/**
 * addTag(scene, x, y, word, {fontSize = 26, maxWidth = 210}) -> Container
 * A word on a label tag (wraps onto two lines past maxWidth). The container has .w and .h (its
 * size, centred on x, y), .bg and .label; setSize is done so it can be made interactive.
 */
export function addTag(scene, x, y, word, { fontSize = 26, maxWidth = 210 } = {}) {
  const label = scene.add.text(0, 0, word, wordStyle(fontSize, {
    align: 'center', wordWrap: { width: maxWidth - 2 * TAG_PAD_X }, lineSpacing: -2,
  })).setOrigin(0.5);
  const w = Math.max(96, Math.ceil(label.width) + 2 * TAG_PAD_X);
  const h = Math.max(TAG_MIN_H, Math.ceil(label.height) + TAG_PAD_TOP + TAG_PAD_BOTTOM);
  const [l, r, t, b] = TAG_SLICE;
  const bg = scene.add.nineslice(0, 0, 'label-tag', undefined, w, h, l, r, t, b);
  label.y = (TAG_PAD_TOP - TAG_PAD_BOTTOM) / 2;
  const c = scene.add.container(x, y, [bg, label]);
  c.w = w;
  c.h = h;
  c.bg = bg;
  c.label = label;
  c.setSize(w, h);
  return c;
}

/**
 * flowParts(scene, parts, {width, fontSize = 30, align = 'left', mark}) -> Container
 * Lays out text pieces as one paragraph wrapped at `width` (container origin = top-left; .w, .h
 * = the size used). parts: Array<{text, kind?, index?} | {pict: kind}>; a pict part is a category
 * pictogram the size of a capital letter. mark(part) -> true puts a highlight marker behind that
 * piece's words (.markers holds them). Line breaks only happen at spaces, never right after a
 * number.
 */
export function flowParts(scene, parts, { width, fontSize = 30, align = 'left', mark = () => false } = {}) {
  const c = scene.add.container(0, 0);
  const style = wordStyle(fontSize);
  const lineH = Math.round(fontSize * 1.42);
  const probe = scene.add.text(0, 0, 'a a', style);
  const probe2 = scene.add.text(0, 0, 'aa', style);
  const spaceW = probe.width - probe2.width;
  probe.destroy();
  probe2.destroy();
  // tokens: words (or picts), each knowing whether a space comes before it
  const tokens = [];
  let space = false;
  for (const part of parts) {
    if (part.br) {
      tokens.push({ part, br: true, space: true, w: 0 });
      space = true; // what follows starts a run of its own (on the new line)
      continue;
    }
    if (part.pict) {
      tokens.push({ part, pict: part.pict, space: true });
      space = true;
      continue;
    }
    let prev = null;
    for (const seg of part.text.split(/(\s+)/)) {
      if (!seg) continue;
      if (/^\s+$/.test(seg)) { space = true; continue; }
      // a number stays on the line of its noun (« 3 bonbons », « trois bonbons »)
      const glued = space && !!prev && NUMBER.test(prev);
      tokens.push({ part, text: seg, space, glued });
      space = false;
      prev = seg;
    }
  }
  // runs: tokens that may not be split across lines (« violet, », « deux fraises »)
  const runs = [];
  tokens.forEach((t, i) => {
    if (i === 0 || (t.space && !t.glued)) runs.push([]);
    runs[runs.length - 1].push(t);
  });
  const pictSize = Math.round(fontSize * 1.25);
  for (const t of tokens) {
    if (t.br) continue;
    if (t.pict) {
      t.obj = scene.add.image(0, 0, pictKey(t.pict)).setOrigin(0, 0.5);
      t.obj.setScale(pictSize / Math.max(t.obj.width, t.obj.height));
      t.w = pictSize;
    } else {
      t.obj = scene.add.text(0, 0, t.text, style).setOrigin(0, 0.5);
      t.w = t.obj.width;
    }
  }
  const lines = [[]];
  let x = 0;
  for (const run of runs) {
    if (run[0].br) {
      lines.push([]);
      x = 0;
      continue;
    }
    const runW = run.reduce((s, t) => s + t.w + (t.glued ? spaceW : 0), 0);
    if (x > 0 && x + spaceW + runW > width) { lines.push([]); x = 0; } else if (x > 0) x += spaceW;
    for (const t of run) {
      if (t.glued) x += spaceW;
      t.x = x;
      x += t.w;
      lines[lines.length - 1].push(t);
    }
  }
  const markers = scene.add.graphics();
  c.add(markers);
  let maxW = 0;
  lines.forEach((line, li) => {
    const lw = line.length ? line[line.length - 1].x + line[line.length - 1].w : 0;
    maxW = Math.max(maxW, lw);
    const dx = align === 'center' ? (width - lw) / 2 : 0;
    const y = li * lineH + lineH / 2;
    for (const t of line) {
      t.obj.setPosition(t.x + dx, y);
      t.line = li;
      t.left = t.x + dx;
      t.y = y;
    }
  });
  // markers: one rounded band per marked piece and line, padded half a space on each side so
  // the words of one piece join up
  const groups = new Map();
  for (const t of tokens) {
    if (t.pict || t.br || !mark(t.part)) continue;
    const k = `${parts.indexOf(t.part)}:${t.line}`;
    const g = groups.get(k);
    if (g) g.right = t.left + t.w;
    else groups.set(k, { left: t.left, right: t.left + t.w, y: t.y });
  }
  markers.fillStyle(MARK, 1);
  for (const g of groups.values()) {
    const pad = spaceW / 2 + 2;
    markers.fillRoundedRect(g.left - pad, g.y - lineH * 0.42, g.right - g.left + 2 * pad, lineH * 0.84, 10);
  }
  c.markers = markers;
  c.marked = groups.size;
  for (const t of tokens) if (t.obj) c.add(t.obj);
  c.w = align === 'center' ? width : maxW;
  c.h = lines.length * lineH;
  return c;
}
