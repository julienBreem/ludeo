// Cuisson timer and clock art. The real SVGs (lot 2 art, branch feat/art-edu2: timer-face-sector,
// timer-sector, timer-face-numbers, timer-hand, clock-face, clock-hour-hand, clock-alarm-hand,
// icon-alarm) are not merged yet: until they are in ASSETS (Boot loads them), these simple drawings
// stand in under the same keys, frames and pivots. Once the SVGs load, textures.exists() is true and
// nothing here is drawn.
//
// Geometry (the art's contract, docs/superpowers/notes/art-geometry.md). Every layer of a dial is
// drawn at the same scale with its own origin (ORIGIN) placed on the dial's pivot; angles are
// clockwise from the top mark:
// - timer (N1, N2): faces 400x400, pivot (200,196). The hand runs 300° for the full gauge (N1) and
//   60° per number (N2: 0 at the top, number k at 60k°). timer-face-sector has NO green;
//   timer-sector is the green layer alone (gauge 0.45..0.70 = 135..210°, radius 146), drawn between
//   the face and the hand. timer-hand 80x130, pivot (40,92), tip 72 px out.
// - clock (N3): clock-face 400x440, pivot (200,250), hour h at 30h°, half-hour ticks. Hour hand
//   80x140, pivot (40,100), 88 px long. Alarm hand 80x200, pivot (40,188), knob centre (40,26)
//   (162 px out), radius 21: too small to grab, so the scene makes the whole dial its touch target.
//   Digits are unreadable below x0.45 (CLOCK_MIN_SCALE): never draw the clock smaller.
// - icon-alarm 160x160.
import { OUTLINE } from '../config.js';
import { GREEN_MIN, GREEN_MAX } from '../logic/bake.js';

export const TIMER_RUN = 300; // degrees for the full N1 gauge (and 5 numbers at N2)
export const CLOCK_MIN_SCALE = 0.45;
export const FRAMES = {
  'timer-face-sector': { w: 400, h: 400, px: 200, py: 196 },
  'timer-sector': { w: 400, h: 400, px: 200, py: 196 },
  'timer-face-numbers': { w: 400, h: 400, px: 200, py: 196 },
  'timer-hand': { w: 80, h: 130, px: 40, py: 92 },
  'clock-face': { w: 400, h: 440, px: 200, py: 250 },
  'clock-hour-hand': { w: 80, h: 140, px: 40, py: 100 },
  'clock-alarm-hand': { w: 80, h: 200, px: 40, py: 188 },
  'icon-alarm': { w: 160, h: 160, px: 80, py: 80 },
};
export const TIMER_KEYS = Object.keys(FRAMES);
export const ALARM_RED = 0xd81b60;
const FACE_R = 180; // face radius around the pivot in the fallbacks
const SECTOR_R = 146;
const FONT = 'Arial Black, Arial, sans-serif';

// The origin that puts a layer's pivot on the dial's pivot.
export function pivotOrigin(key) {
  const f = FRAMES[key];
  return [f.px / f.w, f.py / f.h];
}

// Draws the missing textures (once per game: textures outlive scenes).
export function ensureTimerTextures(scene) {
  for (const key of TIMER_KEYS) {
    if (!scene.textures.exists(key)) DRAW[key](scene, key);
  }
}

function bake(scene, key, g, texts = []) {
  const { w, h } = FRAMES[key];
  const dt = scene.textures.addDynamicTexture(key, w, h);
  dt.draw(g, 0, 0);
  for (const t of texts) dt.draw(t, t.x, t.y);
  g.destroy();
  texts.forEach(t => t.destroy());
}

// Point at `deg` clockwise from the top, r px from the pivot (cx, cy).
const at = (cx, cy, deg, r) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];

function face(scene, cx, cy, rim) {
  const g = scene.make.graphics({}, false);
  g.fillStyle(0x000000, 0.15).fillCircle(cx + 4, cy + 8, FACE_R);
  g.fillStyle(rim, 1).fillCircle(cx, cy, FACE_R);
  g.fillStyle(0xffffff, 1).fillCircle(cx, cy, FACE_R - 18);
  g.lineStyle(6, OUTLINE, 1).strokeCircle(cx, cy, FACE_R);
  return g;
}

function label(scene, text, x, y, px) {
  return scene.make.text({ x, y, text, style: { fontFamily: FONT, fontSize: `${px}px`, color: '#222222' } }, false)
    .setOrigin(0.5);
}

// A hand from its pivot up to `len` px, with a hub (and a knob at the tip for the alarm).
function hand(scene, key, { len, width, color, knob }) {
  const { px, py } = FRAMES[key];
  const g = scene.make.graphics({}, false);
  g.lineStyle(width + 8, OUTLINE, 1).lineBetween(px, py + 6, px, py - len);
  g.lineStyle(width, color, 1).lineBetween(px, py + 6, px, py - len);
  if (knob) {
    g.fillStyle(color, 1).fillCircle(px, py - len, knob);
    g.lineStyle(5, OUTLINE, 1).strokeCircle(px, py - len, knob);
  }
  g.fillStyle(OUTLINE, 1).fillCircle(px, py, 14);
  g.fillStyle(0xffd54f, 1).fillCircle(px, py, 7);
  bake(scene, key, g);
}

const DRAW = {
  'timer-face-sector'(scene, key) {
    const { px, py } = FRAMES[key];
    const g = face(scene, px, py, 0xef5350);
    for (let i = 0; i <= 20; i++) {
      const deg = (i / 20) * TIMER_RUN;
      g.lineStyle(i % 2 ? 3 : 6, OUTLINE, 0.6).lineBetween(...at(px, py, deg, FACE_R - 22), ...at(px, py, deg, FACE_R - (i % 2 ? 32 : 42)));
    }
    bake(scene, key, g);
  },
  'timer-sector'(scene, key) {
    const { px, py } = FRAMES[key];
    const g = scene.make.graphics({}, false);
    const rad = deg => ((deg - 90) * Math.PI) / 180;
    g.fillStyle(0x66bb6a, 1).slice(px, py, SECTOR_R, rad(GREEN_MIN * TIMER_RUN), rad(GREEN_MAX * TIMER_RUN), false).fillPath();
    g.lineStyle(4, OUTLINE, 0.5).slice(px, py, SECTOR_R, rad(GREEN_MIN * TIMER_RUN), rad(GREEN_MAX * TIMER_RUN), false).strokePath();
    bake(scene, key, g);
  },
  'timer-face-numbers'(scene, key) {
    const { px, py } = FRAMES[key];
    const g = face(scene, px, py, 0x29b6f6);
    g.fillStyle(OUTLINE, 1).fillCircle(...at(px, py, 0, FACE_R - 48), 10);
    for (let i = 0; i <= 25; i++) {
      if (i % 5 === 0) continue;
      const deg = (i / 5) * 60;
      g.lineStyle(3, OUTLINE, 0.5).lineBetween(...at(px, py, deg, FACE_R - 22), ...at(px, py, deg, FACE_R - 34));
    }
    const texts = [1, 2, 3, 4, 5].map(n => label(scene, String(n), ...at(px, py, n * 60, FACE_R - 60), 64));
    bake(scene, key, g, texts);
  },
  'timer-hand'(scene, key) {
    hand(scene, key, { len: 72, width: 14, color: 0x1a237e });
  },
  'clock-face'(scene, key) {
    const { px, py } = FRAMES[key];
    const g = scene.make.graphics({}, false);
    // bells and feet (above and under the round face)
    for (const s of [-1, 1]) {
      g.fillStyle(0x42a5f5, 1).fillCircle(px + s * 120, py - 150, 46);
      g.lineStyle(6, OUTLINE, 1).strokeCircle(px + s * 120, py - 150, 46);
    }
    const f = face(scene, px, py, 0x42a5f5);
    for (let i = 0; i < 24; i++) {
      const deg = i * 15;
      f.lineStyle(i % 2 ? 4 : 7, OUTLINE, i % 2 ? 0.5 : 1).lineBetween(...at(px, py, deg, FACE_R - 20), ...at(px, py, deg, FACE_R - (i % 2 ? 32 : 40)));
    }
    const texts = [];
    for (let h = 1; h <= 12; h++) texts.push(label(scene, String(h), ...at(px, py, h * 30, FACE_R - 66), 38));
    const { w, h } = FRAMES[key];
    const dt = scene.textures.addDynamicTexture(key, w, h);
    dt.draw(g, 0, 0);
    dt.draw(f, 0, 0);
    for (const t of texts) dt.draw(t, t.x, t.y);
    [g, f, ...texts].forEach(o => o.destroy());
  },
  'clock-hour-hand'(scene, key) {
    hand(scene, key, { len: 88, width: 22, color: 0x1a237e });
  },
  'clock-alarm-hand'(scene, key) {
    hand(scene, key, { len: 162, width: 8, color: ALARM_RED, knob: 21 });
  },
  'icon-alarm'(scene, key) {
    const g = scene.make.graphics({}, false);
    const c = 80;
    for (const s of [-1, 1]) {
      g.fillStyle(ALARM_RED, 1).fillCircle(c + s * 44, c - 44, 22);
      g.lineStyle(5, OUTLINE, 1).strokeCircle(c + s * 44, c - 44, 22);
      g.lineStyle(8, OUTLINE, 1).lineBetween(c + s * 30, c + 46, c + s * 46, c + 68);
    }
    g.fillStyle(ALARM_RED, 1).fillCircle(c, c + 8, 56);
    g.lineStyle(6, OUTLINE, 1).strokeCircle(c, c + 8, 56);
    g.fillStyle(0xffffff, 1).fillCircle(c, c + 8, 42);
    g.lineStyle(7, OUTLINE, 1).lineBetween(c, c + 8, c, c - 22).lineBetween(c, c + 8, c + 20, c + 18);
    bake(scene, key, g);
  },
};
