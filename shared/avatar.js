// The child's avatar: a client of the collection's client system (shared/client.js: same layers
// and palettes as the stand's customers), drawn on a 2D canvas for the home and the parent space.
// The avatar is a plain Client object, stored in collection.avatar.
import { HAIR_HEX, SKIN_HEX, SHIRT_HEX, ACC_TINT } from './avatar-palettes.js';
import { generateClient, sameClient } from './client.js';

export const FRAME = 300; // every layer is 300x300 (art-geometry notes)
const CLIENT_DIR = './assets/client/';

// Shown until the parent picks one.
export const DEFAULT_AVATAR = { kind: 'human', hair: 3, hairColor: 0, skin: 1, shirt: 1, accessory: null };

const hex = n => `#${n.toString(16).padStart(6, '0')}`;

// Layers to stack, bottom to top: [{ file, tint }] (tint is a CSS colour or null).
export function avatarLayers(avatar) {
  const a = avatar ?? DEFAULT_AVATAR;
  const shirt = hex(SHIRT_HEX[a.shirt % SHIRT_HEX.length]);
  const hair = hex(HAIR_HEX[(a.hairColor ?? 0) % HAIR_HEX.length]);
  const layers = [{ file: 'client-body', tint: shirt }];
  if (a.kind === 'animal') {
    layers.push({ file: `client-animal-${a.animal}`, tint: null });
  } else {
    layers.push({ file: 'client-head', tint: hex(SKIN_HEX[a.skin % SKIN_HEX.length]) });
    if (a.hair > 0) layers.push({ file: `client-hair-${a.hair}`, tint: hair });
    if (a.accessory) {
      const t = ACC_TINT[a.accessory];
      layers.push({ file: `client-acc-${a.accessory}`, tint: t === 'shirt' ? shirt : t === 'hair' ? hair : null });
    }
  }
  layers.push({ file: 'client-eyes-open', tint: null }, { file: 'client-mouth-content', tint: null });
  return layers;
}

// Fixed list for the previous/next buttons: the same random look as the stand's clients,
// drawn from a seeded generator so the order never changes.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PRESETS = (() => {
  const rng = mulberry32(2026);
  const out = [];
  while (out.length < 24) {
    const c = generateClient(rng);
    if (!out.some(p => sameClient(p, c))) out.push(c);
  }
  return out;
})();

// Next (dir = 1) or previous (dir = -1) preset; a custom or missing avatar starts from the ends.
export function stepAvatar(current, dir) {
  const i = PRESETS.findIndex(p => sameClient(p, current));
  if (i < 0) return PRESETS[dir > 0 ? 0 : PRESETS.length - 1];
  return PRESETS[(i + dir + PRESETS.length) % PRESETS.length];
}

export function randomAvatar(current, rng = Math.random) {
  return generateClient(rng, current);
}

// ---- drawing (browser only) ------------------------------------------------------------------
const images = new Map();

function loadLayer(file) {
  if (!images.has(file)) {
    images.set(file, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`avatar layer ${file}`));
      img.src = new URL(`${CLIENT_DIR}${file}.svg`, import.meta.url).href;
    }));
  }
  return images.get(file);
}

// Multiply tint that keeps the layer's own alpha: fill, then keep only where the image is.
function tinted(img, color) {
  const c = document.createElement('canvas');
  c.width = FRAME;
  c.height = FRAME;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, FRAME, FRAME);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = color;
  x.fillRect(0, 0, FRAME, FRAME);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, 0, 0, FRAME, FRAME);
  return c;
}

// Draws the avatar's head and shoulders into canvas (any size: the crop is scaled to fit).
// Resolves to true when drawn, false when an image failed (the caller keeps its fallback).
export async function drawAvatar(canvas, avatar) {
  const layers = avatarLayers(avatar);
  let imgs;
  try {
    imgs = await Promise.all(layers.map(l => loadLayer(l.file)));
  } catch {
    return false;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // crop: head (centre 150,124, radius 86) and the shoulders
  const sx = 30, sy = 10, size = 240;
  const k = canvas.width / size;
  layers.forEach((l, i) => {
    const src = l.tint ? tinted(imgs[i], l.tint) : imgs[i];
    ctx.drawImage(src, sx, sy, size, size, 0, 0, size * k, size * k);
  });
  return true;
}
