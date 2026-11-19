// Order strip, top-left: the ordered cake in 3/4 (one cached texture per order), with the layer
// of the current step glowing: dough -> side band, mould -> outline, bake -> the whole cake,
// paint -> the glazed top, toppings -> the toppings. No digits, no icon list.
// The glow is a solid-colour halo behind the cake (setTintFill: the layer's silhouette in GLOW,
// whatever its own colours) plus a gentle bounce of the cake. Light is never added over the top
// face or the toppings, whose colours are the order: only the side band (dough, bake) and the
// outline (mould) get a pulsing additive fill.
import { TOP_SQUASH, BACKDROP } from '../config.js';
import { FRAME, TOPPING_SIZE } from './cakeView.js';
import { idealCake, orderCakeKey, orderSig, ORDER_PX } from './orderCake.js';

const X = 16;
const Y = 16;
const CARD_W = 204;
const CARD_H = 184;
const UNIT = 0.54; // strip px per frame unit: the cake itself (about 0.7 of the frame) is ~150 px wide
const K = ORDER_PX / FRAME; // texture px per frame unit
const GLOW = 0xffc400;
const HALO_R = 14; // frame units the halo spreads around a layer
const STAND_ORIGIN_Y = 0.8;
const BOUNCE = 1.04;
// Steps whose layer may also get an additive fill over the cake (none of them is the top face).
const FILL_STEPS = ['pate', 'moule', 'cuisson'];

// A highlight texture: the step's layer as a solid GLOW silhouette, at the same scale and centre as the
// cake texture. `halo` spreads it around (copies on two rings) so it shows beyond the cake.
function highlightKey(scene, order, step, halo) {
  const key = `order-hl-${orderSig(order)}-${step}-${halo ? 'halo' : 'fill'}`;
  if (scene.textures.exists(key)) return key;
  const cake = idealCake(scene, order);
  const shape = order.shape;
  const px = Math.ceil(440 * K);
  // every layer part is a solid GLOW silhouette (its own colours are dropped)
  const img = (k2, x = 0, y = 0) => scene.make.image({ x, y, key: k2, add: false }).setTintFill(GLOW);
  const layer = () => {
    const parts = [];
    const top = (k2) => {
      const holder = scene.make.container({ x: 0, y: 0, add: false });
      holder.scaleY = TOP_SQUASH;
      holder.add(img(k2));
      parts.push(holder);
    };
    if (step === 'pate' || step === 'cuisson') parts.push(img(`shape-${shape}-side`));
    // the fill (drawn over the cake) never covers the top face: on cuisson it is the side only
    if (step === 'couleur' || (step === 'cuisson' && halo)) top(`shape-${shape}-fill`);
    if (step === 'moule') top(`shape-${shape}-line`);
    if (step === 'toppings') {
      for (const t of cake.toppings) {
        const ti = img(`topping-${t.key}`, t.x, t.y * TOP_SQUASH).setOrigin(0.5, STAND_ORIGIN_Y);
        ti.setScale(TOPPING_SIZE / Math.max(ti.width, ti.height));
        parts.push(ti);
      }
    }
    return parts;
  };
  const all = scene.make.container({ x: px / 2, y: px / 2, add: false }).setScale(K);
  const offsets = [[0, 0]];
  if (halo) {
    for (const r of [HALO_R, HALO_R / 2]) {
      for (let a = 0; a < 12; a++) offsets.push([Math.cos((a * Math.PI) / 6) * r, Math.sin((a * Math.PI) / 6) * r]);
    }
  }
  for (const [dx, dy] of offsets) {
    const holder = scene.make.container({ x: dx, y: dy, add: false });
    for (const p of layer()) holder.add(p);
    all.add(holder);
  }
  const tex = scene.textures.addDynamicTexture(key, px, px);
  tex.draw(all);
  all.destroy();
  return key;
}

/**
 * addOrderReminder(scene, order, step: 'pate'|'moule'|'cuisson'|'couleur'|'toppings') -> Container
 * The card sits at the top-left, depth 400. Its pulse is a tween owned by the scene.
 */
export function addOrderReminder(scene, order, step) {
  const c = scene.add.container(X, Y).setDepth(400);
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.15).fillRoundedRect(3, 5, CARD_W, CARD_H, 22);
  bg.fillStyle(BACKDROP, 1).fillRoundedRect(0, 0, CARD_W, CARD_H, 22); // pale: white glaze shows
  c.add(bg);
  const scale = UNIT / K;
  const cx = CARD_W / 2;
  const cy = CARD_H / 2 + 4;
  const cake = scene.add.image(cx, cy, orderCakeKey(scene, order)).setScale(scale);
  const halo = scene.add.image(cx, cy, highlightKey(scene, order, step, true)).setScale(scale).setAlpha(0.4);
  c.add([halo, cake]);
  const pulse = { duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' };
  c.glow = scene.tweens.add({ targets: halo, alpha: { from: 0.35, to: 1 }, ...pulse });
  // the cake and its halo swell a little together (about 4 %), at the same beat
  scene.tweens.add({ targets: [halo, cake], scale: { from: scale, to: scale * BOUNCE }, ...pulse });
  if (FILL_STEPS.includes(step)) {
    const fill = scene.add.image(cx, cy, highlightKey(scene, order, step, false)).setScale(scale)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.1);
    c.add(fill);
    scene.tweens.add({ targets: fill, alpha: { from: 0.1, to: 0.45 }, scale: { from: scale, to: scale * BOUNCE }, ...pulse });
  }
  return c;
}
