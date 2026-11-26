// A fish: tinted body + untinted details, scaled by size category. The weight only adds a very
// small extra inside the size, never enough to read it. An optional label tag shows the digit
// and, at level 1, the dice of the weight.
import { COLOR_HEX } from '../config.js';
import { weightRange } from '../logic/fish.js';

export { COLOR_HEX };

export const SIZE_SCALE = { petit: 0.6, moyen: 0.85, grand: 1.1 };
const WEIGHT_EXTRA = 0.04; // scale added between the lightest and the heaviest of a size
const BODY_BOTTOM = 60; // lowest point of the body below the frame centre (frame 240x140)
const TAG_OVERLAP = 12; // screen px the tag overlaps the bottom of the body

// The weight label: digit, plus the dice at level 1 (weights 1..5). Centred on (0, 0), 132x88.
export function weightTag(scene, weight, level = 1) {
  const tag = scene.add.container(0, 0);
  tag.add(scene.add.image(0, 0, 'label').setScale(1.1));
  const dice = level === 1 && weight >= 1 && weight <= 5;
  tag.add(scene.add.text(dice ? -30 : 0, 0, String(weight), {
    fontFamily: 'sans-serif', fontSize: '44px', color: '#1f2a44', fontStyle: 'bold',
  }).setOrigin(0.5));
  if (dice) tag.add(scene.add.image(30, 0, `dice-${weight}`).setDisplaySize(44, 44));
  return tag;
}

// Returns a Container centred on (x, y). catchInfo: { color, size }.
// opts: { weight?, label?, level?, size?, tagSize? } (level picks the weight range for the extra,
// default 1; size multiplies the drawn scale; tagSize is the label's on-screen scale, kept the same
// whatever the fish's size, so labels stay readable on small fish).
export function drawFish(scene, x, y, catchInfo, { weight, label = false, level = 1, size = 1, tagSize = 1 } = {}) {
  let scale = SIZE_SCALE[catchInfo.size] ?? SIZE_SCALE.moyen;
  if (weight !== undefined) {
    const [min, max] = weightRange(catchInfo.size, level);
    if (max > min) scale += WEIGHT_EXTRA * Math.min(1, Math.max(0, (weight - min) / (max - min)));
  }
  scale *= size;
  const body = scene.add.image(0, 0, 'fish-body').setTint(COLOR_HEX[catchInfo.color] ?? 0xffffff);
  const details = scene.add.image(0, 0, 'fish-details');
  const items = [body, details];
  const c = scene.add.container(x, y, items);
  c.setScale(scale);
  c.setSize(body.width, body.height);
  c.catchInfo = catchInfo;
  if (label && weight !== undefined) {
    const tag = weightTag(scene, weight, level);
    tag.setScale(tagSize / scale);
    tag.y = (BODY_BOTTOM * scale - TAG_OVERLAP + 44 * tagSize) / scale;
    c.add(tag);
    c.tag = tag;
  }
  return c;
}
