// Big round icon buttons. The icon textures are complete glossy discs: no backing circle.
import { TOUCH } from '../config.js';

// Squashes on press; fires onTap on pointerup inside, only if the press started on it.
// Disable with img.disableInteractive(), re-enable with img.setInteractive().
export function addIconButton(scene, x, y, textureKey, onTap, { size = TOUCH, tint } = {}) {
  const img = scene.add.image(x, y, textureKey);
  const base = size / Math.max(img.width, img.height);
  img.setScale(base);
  if (tint !== undefined) img.setTint(tint);
  img.setInteractive({ useHandCursor: true });

  let pressed = false;
  const settle = () => {
    scene.tweens.killTweensOf(img);
    scene.tweens.add({ targets: img, scaleX: base, scaleY: base, duration: 120, ease: 'Back.easeOut' });
  };
  img.on('pointerdown', () => {
    pressed = true;
    scene.tweens.killTweensOf(img);
    scene.tweens.add({ targets: img, scaleX: base * 1.12, scaleY: base * 0.86, duration: 80, ease: 'Quad.easeOut' });
  });
  img.on('pointerout', () => {
    if (!pressed) return;
    pressed = false;
    settle();
  });
  img.on('pointerup', (pointer) => {
    if (!pressed) return;
    pressed = false;
    settle();
    onTap(pointer);
  });
  return img;
}
