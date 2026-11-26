// A fish: tinted body + untinted details, scaled by size category. The weight only adds a very
// small extra inside the size, never enough to read it. An optional label tag shows the digit
// and, at level 1, the dice of the weight.
import { COLOR_HEX } from '../config.js';
import { weightRange } from '../logic/fish.js';

export { COLOR_HEX };

const SIZE_SCALE = { petit: 0.6, moyen: 0.85, grand: 1.1 };
const WEIGHT_EXTRA = 0.04; // scale added between the lightest and the heaviest of a size

// Returns a Container centred on (x, y). catchInfo: { color, size }.
// opts: { weight?, label?, level? } (level picks the weight range for the extra, default 1).
export function drawFish(scene, x, y, catchInfo, { weight, label = false, level = 1 } = {}) {
  let scale = SIZE_SCALE[catchInfo.size] ?? SIZE_SCALE.moyen;
  if (weight !== undefined) {
    const [min, max] = weightRange(catchInfo.size, level);
    if (max > min) scale += WEIGHT_EXTRA * Math.min(1, Math.max(0, (weight - min) / (max - min)));
  }
  const body = scene.add.image(0, 0, 'fish-body').setTint(COLOR_HEX[catchInfo.color] ?? 0xffffff);
  const details = scene.add.image(0, 0, 'fish-details');
  const items = [body, details];
  const c = scene.add.container(x, y, items);
  c.setScale(scale);
  c.setSize(body.width, body.height);
  c.catchInfo = catchInfo;
  if (label && weight !== undefined) {
    const tag = scene.add.container(0, 70);
    tag.add(scene.add.image(0, 0, 'label').setScale(1.1));
    if (level === 1 && weight >= 1 && weight <= 5) {
      tag.add(scene.add.image(0, 0, `dice-${weight}`).setDisplaySize(56, 56));
    } else {
      tag.add(scene.add.text(0, 0, String(weight), { fontFamily: 'sans-serif', fontSize: '48px', color: '#1f2a44', fontStyle: 'bold' }).setOrigin(0.5));
    }
    c.add(tag);
    c.tag = tag;
  }
  return c;
}
