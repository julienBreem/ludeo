// Shop: one card per item with a price, four rows by kind (shapes, colours, toppings, decos).
// Coins are spent with economy.buy; a failed tap (unaffordable or owned) only shakes the card.
// Colours follow the Glaçage level: N1 sells ready-made colours (bleu, vert), N2-N3 sells new
// bases to mix (marron, noir) instead.
// Prices follow the Service level (theme `monnaie`): N1 coins of 1 drawn in groups of 5 (two rows of
// five per block of ten, as the egg box; up to 20), no number; N2 the number with a coin; N3 the
// number too, and a tap on a card she cannot afford opens the piggy bank: what she has (filled
// porthole, number) and what is missing (her coins grouped by 5, the missing ones dashed, and the
// missing number). Any tap closes it.
import { W, H, TOUCH, COLOR_HEX, OUTLINE } from '../config.js';
import { getState, updateState } from '../game-state.js';
import { addIconButton } from '../ui/button.js';
import { goTo } from '../ui/flow.js';
import { splash, sparkle } from '../ui/fx.js';
import { dur } from '../ui/pace.js';
import { shopItems, itemById } from '../logic/catalog.js';
import { canBuy, buy } from '../logic/economy.js';
import { phaseLevels } from '../../../../shared/runtime.js';
import { ID } from '../../collection.js';
import { ensureMoneyTextures, coinGroups, piggyBank, dashedCircle, MISSING } from '../ui/moneyArt.js';


const KINDS = ['shape', 'color', 'topping', 'deco'];
const ROW_Y = [165, 325, 485, 645];
const CARD_H = 140;
const TEXT_STYLE = { fontFamily: 'Arial Black, Arial, sans-serif', color: '#222222' };

// The awning and the garland are 1280-wide strips: shrunk whole onto a card they become a thin
// line. The card shows a cropped, larger sample instead (a few scallops / flags).
const DECO_CROP = { auvent: [0, 0, 480, 180], guirlande: [150, 30, 280, 140] };
function decoFrame(scene, key) {
  const crop = DECO_CROP[key];
  if (!crop) return undefined;
  const tex = scene.textures.get(`deco-${key}`);
  if (!tex.has('card')) tex.add('card', 0, ...crop);
  return 'card';
}

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    this.cameras.main.setBackgroundColor(0xfce4ec);
    this.cards = null;
    this.busy = false; // per-visit: a pending unlock from the last visit is dropped on shutdown
    this.piggy = null;
    this.level = phaseLevels(ID).service ?? 1;
    ensureMoneyTextures(this);
    this.coinIcon = this.add.image(W - 250, 60, 'coin').setScale(0.8).setDepth(500);
    this.coinText = this.add.text(W - 175, 60, '', { ...TEXT_STYLE, fontSize: '56px', stroke: '#ffffff', strokeThickness: 8 })
      .setOrigin(0, 0.5).setDepth(500);
    addIconButton(this, 24 + TOUCH / 2, H - 24 - TOUCH / 2, 'icon-next', () => goTo(this, 'Stand'))
      .setFlipX(true).setDepth(500);
    this.render();
  }

  // (Re)builds every card and the coin counter from the current State.
  render() {
    const state = getState();
    this.coinText.setText(String(state.coins));
    if (this.cards) {
      // the bob/shake tweens target the cards' children: kill them, or they pile up forever
      this.cards.each(card => {
        this.tweens.killTweensOf(card);
        card.each(child => this.tweens.killTweensOf(child));
      });
      this.cards.destroy();
    }
    this.cards = this.add.container(0, 0);
    const colorLevel = phaseLevels(ID).couleur ?? 1;
    KINDS.forEach((kind, row) => {
      const items = shopItems(kind, colorLevel);
      // N1: wide enough for two blocks of ten coins side by side
      const cw = this.level === 1 ? 290 : kind === 'deco' ? 230 : 160;
      const gap = this.level === 1 ? 14 : 24;
      const total = items.length * cw + (items.length - 1) * gap;
      items.forEach((item, k) => {
        const x = W / 2 - total / 2 + cw / 2 + k * (cw + gap);
        this.cards.add(this.buildCard(item, x, ROW_Y[row], cw, state));
      });
    });
  }

  picture(item, c, maxSize) {
    const fit = (img, w, h) => { img.setScale(Math.min(w / img.width, h / img.height)); return img; };
    if (item.kind === 'shape') {
      c.add(fit(this.add.image(0, 0, `mold-${item.key}-back`), maxSize, maxSize));
      c.add(fit(this.add.image(0, 0, `mold-${item.key}-front`), maxSize, maxSize));
    } else if (item.kind === 'color') {
      c.add(fit(this.add.image(0, 0, 'pot'), maxSize, maxSize).setTint(COLOR_HEX[item.key]));
    } else if (item.kind === 'topping') {
      c.add(fit(this.add.image(0, 0, `topping-${item.key}`), maxSize, maxSize));
    } else {
      c.add(fit(this.add.image(0, 0, `deco-${item.key}`, decoFrame(this, item.key)), 210, maxSize + 16));
    }
  }

  buildCard(item, x, y, cw, state) {
    const owned = state.owned.includes(item.id);
    const affordable = canBuy(state, item.id);
    const card = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(owned ? 0xdcedc8 : affordable ? 0xffffff : 0xcfcfcf, 1).fillRoundedRect(-cw / 2, -CARD_H / 2, cw, CARD_H, 26);
    bg.lineStyle(5, OUTLINE, affordable || owned ? 1 : 0.4).strokeRoundedRect(-cw / 2, -CARD_H / 2, cw, CARD_H, 26);
    card.add(bg);

    const n1 = this.level === 1;
    const pic = this.add.container(0, n1 ? -32 : -18);
    this.picture(item, pic, n1 ? 64 : 84);
    if (!affordable && !owned) pic.setAlpha(0.45);
    card.add(pic);

    if (owned) {
      card.add(this.add.image(cw / 2 - 30, -CARD_H / 2 + 30, 'icon-ok').setDisplaySize(72, 72));
      pic.setPosition(0, 0);
    } else if (n1) {
      // the price as coins of 1, grouped by 5 (text-free)
      const { c } = coinGroups(this, item.price, { size: 30, pitch: 26, rowGap: 25, blockGap: 12 });
      c.setPosition(0, 38);
      if (!affordable) c.setAlpha(0.6);
      card.add(c);
      card.priceCoins = item.price;
    } else {
      const coin = this.add.image(-24, 48, 'coin').setDisplaySize(40, 40);
      const price = this.add.text(4, 48, String(item.price), { ...TEXT_STYLE, fontSize: '40px' }).setOrigin(0, 0.5);
      if (!affordable) { coin.setAlpha(0.5); price.setAlpha(0.6); }
      card.add([coin, price]);
    }
    if (affordable) {
      this.tweens.add({ targets: pic, y: pic.y - 6, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const hit = this.add.zone(0, 0, cw, CARD_H).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.tap(item, card, x, y));
    card.add(hit);
    return card;
  }

  tap(item, card, x, y) {
    if (this.busy || this.piggy) return;
    if (!canBuy(getState(), item.id)) {
      this.tweens.add({ targets: card, x: { from: x - 10, to: x }, duration: 220, ease: 'Bounce.easeOut' });
      if (this.level >= 3 && !getState().owned.includes(item.id)) this.showPiggy(item);
      return;
    }
    this.busy = true;
    updateState(s => buy(s, item.id) ?? s);
    splash(this, x, y, 0xffd54f);
    sparkle(this, x, y);
    this.time.delayedCall(450, () => { this.busy = false; });
    this.render();
  }

  // N3: « combien me manque-t-il ? » for an item she cannot afford yet (price <= 20).
  showPiggy(item) {
    const have = Math.max(0, getState().coins);
    const price = itemById(item.id).price;
    const missing = Math.max(0, price - have);
    const layer = this.add.container(0, 0).setDepth(800);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.35).setInteractive();
    layer.add(dim);
    const PW = 900;
    const PH = 440;
    const px = W / 2;
    const py = H / 2;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.15).fillRoundedRect(px - PW / 2 + 4, py - PH / 2 + 8, PW, PH, 36);
    bg.fillStyle(0xffffff, 1).fillRoundedRect(px - PW / 2, py - PH / 2, PW, PH, 36);
    bg.lineStyle(6, OUTLINE, 1).strokeRoundedRect(px - PW / 2, py - PH / 2, PW, PH, 36);
    layer.add(bg);
    // what she has: the piggy bank filled to have / price, and the number
    layer.add(piggyBank(this, px - 280, py - 60, price ? have / price : 1, 0.72));
    layer.add(this.add.text(px - 280, py + 110, String(have), { ...TEXT_STYLE, fontSize: '64px' }).setOrigin(0.5));
    // the price in coins of 1 grouped by 5: hers, then the missing ones dashed
    const { c } = coinGroups(this, Math.min(have, price), { missing, size: 44, pitch: 44, rowGap: 46, blockGap: 16, blocks: 'stack' });
    c.setPosition(px + 20, py - 40);
    layer.add(c);
    // the missing number, by a dashed coin
    const g = this.add.graphics();
    dashedCircle(g, px - 30, py + 150, 22, 4, MISSING);
    layer.add(g);
    layer.add(this.add.text(px + 4, py + 150, String(missing), { ...TEXT_STYLE, fontSize: '60px', color: '#c2336f' }).setOrigin(0, 0.5));
    // the item and its price
    const pic = this.add.container(px + 300, py - 60);
    this.picture(item, pic, 120);
    layer.add(pic);
    layer.add(this.add.image(px + 270, py + 110, 'coin').setDisplaySize(48, 48));
    layer.add(this.add.text(px + 304, py + 110, String(price), { ...TEXT_STYLE, fontSize: '56px' }).setOrigin(0, 0.5));
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: dur(200) });
    this.piggy = { layer, dim, have, price, missing };
    // any tap closes it (after a short moment, so the opening tap does not)
    this.time.delayedCall(dur(250), () => dim.once('pointerup', () => this.closePiggy()));
  }

  closePiggy() {
    if (!this.piggy) return;
    const { layer, dim } = this.piggy;
    this.piggy = null;
    dim.disableInteractive(); // the fading layer must not catch the next tap (the back button)
    this.tweens.add({ targets: layer, alpha: 0, duration: dur(180), onComplete: () => layer.destroy() });
  }
}
