// Order reminder strip, top-left: dessert, shape outline, colour dot, topping ×N (copies + digit).
import { COLOR_HEX, OUTLINE } from '../config.js';
import { drawCake } from './cakeView.js';

const X = 16;
const Y = 16;
const HEIGHT = 96;
const CELL = 84; // width given to one icon
const ICON = 72;
const PAD = 12;

// The returned container has .stripWidth and .append(gameObject, width = CELL), which adds an
// item at the right end of the strip and widens it (Bake uses it for the target flames).
export function addOrderReminder(scene, order) {
  const c = scene.add.container(X, Y).setDepth(400);
  const bg = scene.add.graphics();
  c.add(bg);
  let cursor = PAD;
  const redraw = () => {
    bg.clear();
    bg.fillStyle(0x000000, 0.15).fillRoundedRect(3, 5, cursor + PAD, HEIGHT, 22);
    bg.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, cursor + PAD, HEIGHT, 22);
    c.stripWidth = cursor + PAD;
  };
  c.append = (obj, width = CELL) => {
    obj.setPosition(cursor + width / 2, HEIGHT / 2);
    c.add(obj);
    cursor += width;
    redraw();
    return obj;
  };
  const icon = (key, size = ICON) => {
    const img = scene.add.image(0, 0, key);
    img.setScale(size / Math.max(img.width, img.height));
    return img;
  };

  // dessert: a small round 3/4 cake of that dessert (the shape is shown next to it)
  const mini = drawCake(scene, 0, 0, { dessert: order.dessert, shape: 'rond', bake: 'dore', toppings: [] }, { size: 92 });
  const holder = scene.add.container(0, 0, [mini]);
  mini.y = -6;
  c.append(holder);
  const silhouette = scene.add.container(0, 0, [
    icon(`shape-${order.shape}-fill`, 80).setTint(0xe6e6e6),
    icon(`shape-${order.shape}-line`, 80),
  ]);
  c.append(silhouette);
  const dot = scene.add.graphics();
  dot.fillStyle(COLOR_HEX[order.color], 1).fillCircle(0, 0, 28);
  dot.lineStyle(3, OUTLINE, 0.6).strokeCircle(0, 0, 28);
  c.append(dot);

  const n = order.toppingCount;
  const spacing = 34;
  const group = scene.add.container(0, 0);
  for (let i = 0; i < n; i++) {
    const t = icon(`topping-${order.topping}`, 60);
    t.x = (i - (n - 1) / 2) * spacing;
    group.add(t);
  }
  c.append(group, (n - 1) * spacing + 66);
  const digit = scene.add.text(0, 0, String(n), {
    fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '52px', color: '#222222',
    stroke: '#ffffff', strokeThickness: 6,
  }).setOrigin(0.5);
  c.append(digit, 56);
  return c;
}
