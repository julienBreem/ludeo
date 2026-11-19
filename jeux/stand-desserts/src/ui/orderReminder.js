// Order strip, top-left. At Commande N2 / N3 it shows the order's words / sentence instead (the
// memory part of those levels), with the current step's words marked. At N1: the ordered cake in
// 3/4 (one cached texture per order), with the layer of the current step glowing: dough -> side band, mould -> outline, bake -> the whole cake,
// paint -> the glazed top, toppings -> the toppings. No digits, no icon list.
// The glow is a solid-colour halo behind the cake (setTintFill: the layer's silhouette in GLOW,
// whatever its own colours; for toppings a yellow ring around each one, over the cake) plus a
// gentle bounce of the cake. Light is never added over the top face or the toppings, whose
// colours are the order: only the side band (dough, bake) and the outline (mould) get a pulsing
// additive fill.
import { TOP_SQUASH, BACKDROP } from '../config.js';
import { FRAME, TOPPING_SIZE } from './cakeView.js';
import { idealCake, orderCakeKey, orderSig, ORDER_PX } from './orderCake.js';
import { orderSentenceParts, orderWordParts } from '../logic/orderText.js';
import { ensureWordTextures, flowParts } from './words.js';

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
export function highlightKey(scene, order, step, halo) {
  const key = `order-hl-${orderSig(order)}-${step}-${halo ? 'halo' : 'fill'}`;
  if (scene.textures.exists(key)) return key;
  const cake = idealCake(scene, order);
  const shape = order.shape;
  const px = Math.ceil(440 * K);
  // every layer part is a solid GLOW silhouette (its own colours are dropped)
  const plain = (k2, x = 0, y = 0) => scene.make.image({ x, y, key: k2, add: false });
  const img = (k2, x, y) => plain(k2, x, y).setTintFill(GLOW);
  const topOf = (image) => {
    const holder = scene.make.container({ x: 0, y: 0, add: false });
    holder.scaleY = TOP_SQUASH;
    holder.add(image);
    return holder;
  };
  const standing = (make) => cake.toppings.map(t => {
    const ti = make(`topping-${t.key}`, t.x, t.y * TOP_SQUASH).setOrigin(0.5, STAND_ORIGIN_Y);
    return ti.setScale(TOPPING_SIZE / Math.max(ti.width, ti.height));
  });
  const layer = () => {
    const parts = [];
    const top = k2 => parts.push(topOf(img(k2)));
    if (step === 'pate' || step === 'cuisson') parts.push(img(`shape-${shape}-side`));
    // the fill (drawn over the cake) never covers the top face: on cuisson it is the side only
    if (step === 'couleur' || (step === 'cuisson' && halo)) top(`shape-${shape}-fill`);
    if (step === 'moule') top(`shape-${shape}-line`);
    if (step === 'toppings') parts.push(...standing(img));
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
  // Toppings stand on the cake, so their halo is shown over it: each topping is drawn again in
  // its own colours over its yellow ring, which then reads as an outline glow.
  if (halo && step === 'toppings') for (const p of standing(plain)) all.add(p);
  const tex = scene.textures.addDynamicTexture(key, px, px);
  tex.draw(all);
  all.destroy();
  // The additive fill must never light the order's colours: cut the top face (dough, bake) and
  // the toppings out of it.
  if (!halo) {
    const cut = scene.make.container({ x: px / 2, y: px / 2, add: false }).setScale(K);
    if (step !== 'moule') cut.add(topOf(plain(`shape-${shape}-fill`)));
    for (const p of standing(plain)) cut.add(p);
    tex.erase(cut);
    cut.destroy();
  }
  return key;
}

// The words of the order that belong to a step (the dough and the bake have none).
const STEP_KIND = { moule: 'forme', couleur: 'couleur', toppings: 'topping' };
const WORDS_PAD = 14;
// Text width and font size of the word card, tried in this order until the card is at most
// WORDS_MAX_H tall: a long N3 sentence (3 colours, 3 kinds) gets a smaller font on a wider card
// instead of growing down over the scene (the Pâte tray sits below it, from y 202).
const WORDS_FITS = [{ width: 300, fontSize: 22 }, { width: 360, fontSize: 19 }, { width: 400, fontSize: 17 }];
const WORDS_MAX_H = 168;

// Commande N2 / N3: the card shows the words (N2, by category with pictograms) or the sentence
// (N3) instead of the picture; the step's words get a pulsing marker.
function addWordReminder(scene, order, step, level) {
  ensureWordTextures(scene);
  const kind = STEP_KIND[step];
  const parts = level >= 3 ? orderSentenceParts(order) : orderWordParts(order);
  const mark = p => !!kind && p.kind === kind;
  let text = null;
  for (const [i, fit] of WORDS_FITS.entries()) {
    text?.destroy();
    text = flowParts(scene, parts, { ...fit, mark });
    if (text.h + 2 * WORDS_PAD - 4 <= WORDS_MAX_H || i === WORDS_FITS.length - 1) break;
  }
  const w = text.w + 2 * WORDS_PAD;
  const h = text.h + 2 * WORDS_PAD - 4;
  const c = scene.add.container(X, Y).setDepth(400);
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.15).fillRoundedRect(3, 5, w, h, 22);
  bg.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, w, h, 22);
  text.setPosition(WORDS_PAD, WORDS_PAD - 2);
  c.add([bg, text]);
  c.words = text;
  if (text.marked) {
    c.glow = scene.tweens.add({
      targets: text.markers, alpha: { from: 0.35, to: 1 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }
  return c;
}

/**
 * addOrderReminder(scene, order, step: 'pate'|'moule'|'cuisson'|'couleur'|'toppings', level = 1)
 *   -> Container
 * The card sits at the top-left, depth 400. Its pulse is a tween owned by the scene. `level` is
 * the round's Commande level: 1 shows the cake, 2 the words, 3 the sentence.
 */
export function addOrderReminder(scene, order, step, level = 1) {
  if (level >= 2) return addWordReminder(scene, order, step, level);
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
  c.add(step === 'toppings' ? [cake, halo] : [halo, cake]); // toppings: the ringed toppings over the cake
  const pulse = { duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' };
  // the toppings' ring sits over the glaze: never so faint that it muddies it
  c.glow = scene.tweens.add({ targets: halo, alpha: { from: step === 'toppings' ? 0.55 : 0.35, to: 1 }, ...pulse });
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
