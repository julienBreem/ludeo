// Shop: one card per item with a price, four rows by kind (shapes, colours, toppings, decos).
// Coins are spent with economy.buy; a failed tap (unaffordable or owned) only shakes the card.
import { W, H, TOUCH, COLOR_HEX, OUTLINE } from '../config.js';
import { getState, updateState } from '../game-state.js';
import { addIconButton } from '../ui/button.js';
import { goTo } from '../ui/flow.js';
import { splash, sparkle } from '../ui/fx.js';
import { ITEMS } from '../logic/catalog.js';
import { canBuy, buy } from '../logic/economy.js';

const KINDS = ['shape', 'color', 'topping', 'deco'];
const ROW_Y = [165, 325, 485, 645];
const CARD_H = 140;
const TEXT_STYLE = { fontFamily: 'Arial Black, Arial, sans-serif', color: '#222222' };

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    this.cameras.main.setBackgroundColor(0xfce4ec);
    this.cards = null;
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
    if (this.cards) this.cards.destroy();
    this.cards = this.add.container(0, 0);
    KINDS.forEach((kind, row) => {
      const items = ITEMS.filter(i => i.kind === kind && i.price > 0);
      const cw = kind === 'deco' ? 230 : 160;
      const gap = 24;
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
      c.add(fit(this.add.image(0, 0, `deco-${item.key}`), 200, maxSize));
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

    const pic = this.add.container(0, -18);
    this.picture(item, pic, 84);
    if (!affordable && !owned) pic.setAlpha(0.45);
    card.add(pic);

    if (owned) {
      card.add(this.add.image(cw / 2 - 30, -CARD_H / 2 + 30, 'icon-ok').setDisplaySize(72, 72));
      pic.setPosition(0, 0);
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
    if (this.busy) return;
    if (!canBuy(getState(), item.id)) {
      this.tweens.add({ targets: card, x: { from: x - 10, to: x }, duration: 220, ease: 'Bounce.easeOut' });
      return;
    }
    this.busy = true;
    updateState(s => buy(s, item.id) ?? s);
    splash(this, x, y, 0xffd54f);
    sparkle(this, x, y);
    this.time.delayedCall(450, () => { this.busy = false; });
    this.render();
  }
}
