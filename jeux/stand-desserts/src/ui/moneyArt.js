// Money art (Service cash step and Shop, theme `monnaie`): coin-1, coin-2, note-5, note-10, till,
// ticket, counter-tray, piggy-bank, piggy-bank-mask. The SVGs (lot 4 art, branch feat/art-edu4) may
// not be loaded yet: ensureMoneyTextures then draws simple stand-ins under the same keys and frames.
// Once the SVGs load, textures.exists() is true and nothing here is drawn.
//
// Geometry (the art's contract, docs/superpowers/notes/art-geometry.md "Educational lot 4 art"):
// - coins 160x160 (coin-1 face r 62 at (80,79); coin-2 face r 72 at (80,78)); notes 240x140.
// - till 420x420: drawer compartments 1, 2, 5, 10 centred x 60/160/260/360, y 296, ~90 px wide;
//   drop zone of a compartment x ±48, y 244..340; the whole drawer x 14..406, y 240..394; coins at
//   scale 0.45, notes 0.32, each next one in a pile 9 px higher and 6 px aside; keep money above y 340.
// - counter-tray 480x160: money centred on frame y 74.
// - ticket 220x310: blank area x 30..190, y 64..218.
// - piggy-bank 340x280: porthole ellipse centre (200,156), radii 58 x 44; fill top y = 200 - 88 x f.

export const MONEY_FRAMES = {
  'coin-1': { w: 160, h: 160 },
  'coin-2': { w: 160, h: 160 },
  'note-5': { w: 240, h: 140 },
  'note-10': { w: 240, h: 140 },
  till: { w: 420, h: 420 },
  ticket: { w: 220, h: 310 },
  'counter-tray': { w: 480, h: 160 },
  'piggy-bank': { w: 340, h: 280 },
  'piggy-bank-mask': { w: 340, h: 280 },
};
export const MONEY_KEYS = Object.keys(MONEY_FRAMES);

export const TILL = {
  slots: { 1: { x: 60, y: 296 }, 2: { x: 160, y: 296 }, 5: { x: 260, y: 296 }, 10: { x: 360, y: 296 } },
  slotHalfW: 48,
  slotTop: 244,
  slotBottom: 340,
  drawer: { x0: 14, x1: 406, y0: 240, y1: 394 },
  coinScale: 0.45,
  noteScale: 0.32,
  pileDy: -9,
  pileDx: 6,
};
export const TRAY_Y = 74; // money line in the counter-tray frame
export const TICKET_AREA = { x0: 30, x1: 190, y0: 64, y1: 218 };
export const PIGGY_HOLE = { x: 200, y: 156, rx: 58, ry: 44, bottom: 200, depth: 88 };
export const MISSING = 0xc2336f; // a missing coin: dashed circle in this colour

export const moneyKey = v => (v >= 5 ? `note-${v}` : `coin-${v}`);
export const isNote = v => v >= 5;

const FONT = 'Arial Black, Arial, sans-serif';

function bake(scene, key, g, texts = []) {
  const { w, h } = MONEY_FRAMES[key];
  const dt = scene.textures.addDynamicTexture(key, w, h);
  dt.draw(g, 0, 0);
  for (const t of texts) dt.draw(t, t.x, t.y);
  g.destroy();
  texts.forEach(t => t.destroy());
}

function digit(scene, text, x, y, px, color = '#7a4a00') {
  // origin 0.5 is ignored by DynamicTexture.draw: place the top-left by hand
  const t = scene.make.text({ x: 0, y: 0, text, style: { fontFamily: FONT, fontSize: `${px}px`, color } }, false);
  t.setPosition(x - t.width / 2, y - t.height / 2);
  return t;
}

const DRAW = {
  'coin-1'(scene, key) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xb7791f, 1).fillCircle(80, 85, 62);
    g.fillStyle(0xffc928, 1).fillCircle(80, 79, 62);
    g.lineStyle(5, 0x9a6200, 1).strokeCircle(80, 79, 62);
    g.lineStyle(4, 0xffe27a, 1).strokeCircle(80, 79, 50);
    bake(scene, key, g, [digit(scene, '1', 80, 80, 76)]);
  },
  'coin-2'(scene, key) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x8f9aa3, 1).fillCircle(80, 84, 72);
    g.fillStyle(0xdfe5ea, 1).fillCircle(80, 78, 72);
    g.lineStyle(5, 0x6d7780, 1).strokeCircle(80, 78, 72);
    g.fillStyle(0xffc928, 1).fillCircle(80, 78, 50);
    g.lineStyle(4, 0x9a6200, 1).strokeCircle(80, 78, 50);
    bake(scene, key, g, [digit(scene, '2', 80, 79, 76)]);
  },
  'note-5'(scene, key) { note(scene, key, '5', 0xbfe8c4, 0x2e7d32); },
  'note-10'(scene, key) { note(scene, key, '10', 0xbfdcf5, 0x1565c0); },
  till(scene, key) {
    const g = scene.make.graphics({}, false);
    const TQ = 0x3cc8c0;
    const TQD = 0x1f8f89;
    // screen pod
    g.fillStyle(TQ, 1).fillRoundedRect(150, 8, 192, 86, 18);
    g.lineStyle(5, TQD, 1).strokeRoundedRect(150, 8, 192, 86, 18);
    g.fillStyle(0x24324a, 1).fillRoundedRect(176, 22, 140, 56, 10);
    // body with keys
    g.fillStyle(TQ, 1).fillRoundedRect(30, 84, 360, 150, 22);
    g.lineStyle(5, TQD, 1).strokeRoundedRect(30, 84, 360, 150, 22);
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 5; k++) {
        g.fillStyle(k >= 3 ? 0xffd54f : 0xffffff, 1).fillRoundedRect(62 + k * 52, 112 + r * 46, 40, 30, 7);
      }
    }
    // drawer: dark inside, four compartments, front lip
    g.fillStyle(0x24324a, 1);
    g.beginPath();
    g.moveTo(40, 240); g.lineTo(380, 240); g.lineTo(406, 340); g.lineTo(14, 340);
    g.closePath(); g.fillPath();
    g.lineStyle(5, TQD, 1).strokePath();
    g.lineStyle(5, 0x3a4a66, 1);
    for (const x of [110, 210, 310]) g.lineBetween(x, 242, x + (x - 210) * 0.12, 338);
    g.fillStyle(TQ, 1).fillRoundedRect(10, 340, 400, 54, 12);
    g.lineStyle(5, TQD, 1).strokeRoundedRect(10, 340, 400, 54, 12);
    const tags = [['1', 60], ['2', 160], ['5', 260], ['10', 360]].map(([t, x]) => {
      g.fillStyle(0xffffff, 1).fillRoundedRect(x - 26, 352, 52, 30, 8);
      return digit(scene, t, x, 367, 22, '#24324a');
    });
    bake(scene, key, g, tags);
  },
  ticket(scene, key) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0x000000, 0.12).fillRect(22, 16, 188, 282);
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(16, 10); g.lineTo(204, 10); g.lineTo(204, 280);
    for (let i = 0; i < 8; i++) { g.lineTo(204 - 11.75 * (2 * i + 1), 292); g.lineTo(204 - 11.75 * (2 * i + 2), 280); }
    g.closePath(); g.fillPath();
    g.lineStyle(4, 0xb0bec5, 1).strokePath();
    g.fillStyle(0xf48fb1, 1).fillRect(18, 12, 184, 40);
    g.lineStyle(3, 0xcfd8dc, 1).lineBetween(36, 240, 184, 240).lineBetween(36, 256, 150, 256);
    bake(scene, key, g);
  },
  'counter-tray'(scene, key) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xb0bec5, 1).fillRoundedRect(8, 30, 464, 124, 26);
    g.fillStyle(0xffffff, 1).fillRoundedRect(8, 20, 464, 124, 26);
    g.lineStyle(5, 0x5c6b7a, 1).strokeRoundedRect(8, 20, 464, 124, 26);
    g.fillStyle(0x283a73, 1);
    g.beginPath();
    g.moveTo(74, 38); g.lineTo(406, 38); g.lineTo(430, 110); g.lineTo(50, 110);
    g.closePath(); g.fillPath();
    bake(scene, key, g);
  },
  'piggy-bank'(scene, key) {
    const g = scene.make.graphics({}, false);
    const P = 0xf8a5c2;
    const PD = 0xc2336f;
    g.fillStyle(0x000000, 0.1).fillEllipse(180, 262, 240, 24);
    g.fillStyle(P, 1);
    for (const x of [110, 170, 220, 262]) g.fillRoundedRect(x - 18, 190, 36, 64, 10);
    g.fillEllipse(180, 150, 280, 200);
    g.lineStyle(5, PD, 1).strokeEllipse(180, 150, 280, 200);
    g.fillCircle(40, 146, 34).strokeCircle(40, 146, 34); // snout
    g.fillStyle(PD, 1).fillCircle(30, 140, 6).fillCircle(50, 140, 6);
    g.fillStyle(P, 1).fillTriangle(70, 70, 92, 20, 120, 64); // ear
    g.lineStyle(5, PD, 1).strokeTriangle(70, 70, 92, 20, 120, 64);
    g.fillStyle(0x222222, 1).fillCircle(86, 108, 8);
    g.fillStyle(PD, 1).fillRoundedRect(172, 54, 60, 14, 6); // slot
    // porthole: empty inside
    g.fillStyle(0x7a2a4a, 1).fillEllipse(200, 156, 116, 88);
    g.lineStyle(7, 0xffffff, 1).strokeEllipse(200, 156, 122, 94);
    g.lineStyle(4, PD, 1).strokeEllipse(200, 156, 132, 104);
    bake(scene, key, g);
  },
  'piggy-bank-mask'(scene, key) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillEllipse(PIGGY_HOLE.x, PIGGY_HOLE.y, PIGGY_HOLE.rx * 2, PIGGY_HOLE.ry * 2);
    bake(scene, key, g);
  },
};

function note(scene, key, text, paper, ink) {
  const g = scene.make.graphics({}, false);
  g.fillStyle(0x000000, 0.15).fillRoundedRect(5, 14, 230, 118, 12);
  g.fillStyle(paper, 1).fillRoundedRect(5, 7, 230, 118, 12);
  g.lineStyle(5, ink, 1).strokeRoundedRect(5, 7, 230, 118, 12);
  g.lineStyle(3, ink, 0.5).strokeRoundedRect(17, 19, 206, 94, 8);
  g.fillStyle(0xffffff, 1).fillCircle(120, 66, 44);
  g.lineStyle(4, ink, 1).strokeCircle(120, 66, 44);
  const color = `#${ink.toString(16).padStart(6, '0')}`;
  bake(scene, key, g, [digit(scene, text, 120, 67, text.length > 1 ? 50 : 64, color)]);
}

// Draws the missing textures (once per game: textures outlive scenes).
export function ensureMoneyTextures(scene) {
  for (const key of MONEY_KEYS) {
    if (!scene.textures.exists(key)) DRAW[key](scene, key);
  }
}

// Coins of 1 grouped by 5, in blocks of ten (two rows of five, as the egg box): `have` gold coins,
// then `missing` dashed circles. Returns {c, w, h}: a container centred on (0, 0).
// size: a coin's frame px (its face is ~3/4 of it); pitch: centre to centre.
export function coinGroups(scene, have, { missing = 0, size = 54, pitch = 50, rowGap = 54, blockGap = 14, blocks = 'side' } = {}) {
  const total = have + missing;
  const c = scene.add.container(0, 0);
  const nBlocks = Math.max(1, Math.ceil(total / 10));
  const blockW = 5 * pitch;
  const rowsPerBlock = total > 5 ? 2 : 1;
  const side = blocks === 'side';
  const w = side ? nBlocks * blockW + (nBlocks - 1) * blockGap : blockW;
  const blockH = rowsPerBlock * rowGap;
  const h = side ? blockH : nBlocks * blockH + (nBlocks - 1) * blockGap;
  const g = scene.add.graphics();
  c.add(g);
  const r = size * 0.39;
  for (let i = 0; i < total; i++) {
    const b = Math.floor(i / 10);
    const row = Math.floor((i % 10) / 5);
    const col = i % 5;
    const x = -w / 2 + (side ? b * (blockW + blockGap) : 0) + pitch / 2 + col * pitch;
    const y = -h / 2 + (side ? 0 : b * (blockH + blockGap)) + rowGap / 2 + row * rowGap;
    if (i < have) {
      c.add(scene.add.image(x, y, 'coin-1').setDisplaySize(size, size));
    } else {
      g.fillStyle(0xffffff, 1).fillCircle(x, y, r);
      dashedCircle(g, x, y, r, Math.max(2, size / 14), MISSING);
    }
  }
  return { c, w, h };
}

export function dashedCircle(g, x, y, r, width, color) {
  g.lineStyle(width, color, 1);
  const n = 10;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / n / 2;
    g.beginPath();
    g.arc(x, y, r, a0, a1, false);
    g.strokePath();
  }
}

// The piggy bank at (x, y) with its porthole filled to `fraction` (0..1).
export function piggyBank(scene, x, y, fraction, scale = 1) {
  const c = scene.add.container(x, y);
  const pig = scene.add.image(0, 0, 'piggy-bank');
  c.add(pig);
  const f = Math.max(0, Math.min(1, fraction));
  if (f > 0) {
    const { w, h } = MONEY_FRAMES['piggy-bank'];
    const ox = -w / 2;
    const oy = -h / 2;
    const top = PIGGY_HOLE.bottom - PIGGY_HOLE.depth * f;
    // the fill clipped to the porthole ellipse, drawn as horizontal slices (no mask needed)
    const g = scene.add.graphics();
    const { x: hx, y: hy, rx, ry } = PIGGY_HOLE;
    for (let yy = Math.ceil(top); yy < hy + ry; yy += 2) {
      const t = (yy - hy) / ry;
      if (Math.abs(t) >= 1) continue;
      const half = rx * Math.sqrt(1 - t * t);
      g.fillStyle(yy < top + 7 ? 0xfff176 : 0xffc928, 1).fillRect(ox + hx - half, oy + yy, half * 2, 2);
    }
    c.add(g);
  }
  c.setScale(scale);
  return c;
}
