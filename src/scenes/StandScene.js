// Stand: the client walks in and shows the order as the finished cake in one big bubble.
// Also hosts the parent zone (3 s press top-left: reset the save).
import { W, H, TOUCH, OUTLINE } from '../config.js';
import { newRound, getState, updateState, getStorage } from '../game-state.js';
import { addIconButton } from '../ui/button.js';
import { drawClient } from '../ui/client.js';
import { orderCakeKey } from '../ui/orderCake.js';
import { blink, popIn, talk } from '../ui/fx.js';
import { goNext, goTo, restart } from '../ui/flow.js';
import { resetState, defaultState } from '../logic/save.js';

const CLIENT_X = 360;
const CLIENT_Y = 470;
const BUBBLE_X = 880;
const BUBBLE_Y = 385;
const BUBBLE_SCALE = 1.25;
const BUBBLE_W = 440 * BUBBLE_SCALE;
const BUBBLE_H = 340 * BUBBLE_SCALE;
// centre of the bubble's content area (frame 230,162 in a 440x340 frame)
const CONTENT_X = BUBBLE_X + (230 - 220) * BUBBLE_SCALE;
const CONTENT_Y = BUBBLE_Y + (162 - 170) * BUBBLE_SCALE;
const PICTURE_SCALE = 0.88; // the cake itself is then about 360 px wide
const HOLD_MS = 3000;
const ZONE = 120;
const TEXT_STYLE = { fontFamily: 'Arial Black, Arial, sans-serif', color: '#222222' };

export class StandScene extends Phaser.Scene {
  constructor() {
    super('Stand');
  }

  create() {
    const round = newRound();
    const owned = getState().owned;
    this.ready = false;
    this.overlay = null;

    this.drawBackground(owned);
    this.drawCoins();
    addIconButton(this, 24 + TOUCH / 2, H - 24 - TOUCH / 2, 'icon-shop', () => goTo(this, 'Shop')).setDepth(500);

    this.client = drawClient(this, W + 220, CLIENT_Y, round.client, 'content');
    this.client.setDepth(10);
    blink(this, this.client);
    this.add.image(W / 2, H - 130, 'stand-counter').setDepth(20);
    if (owned.includes('deco:pancarte')) {
      this.add.image(230, 585, 'deco-pancarte').setScale(0.7).setDepth(21);
    }

    // bubble, picture, validate button
    this.bubble = this.add.image(BUBBLE_X, BUBBLE_Y, 'bubble').setScale(BUBBLE_SCALE).setDepth(30).setVisible(false);
    this.bubble.setInteractive({ useHandCursor: true });
    this.bubble.on('pointerup', () => this.advance());
    // the finished cake of the order, in one big bubble (cached texture, no mask)
    this.picture = this.add.image(CONTENT_X, CONTENT_Y - 14, orderCakeKey(this, round.order))
      .setScale(PICTURE_SCALE).setDepth(32).setVisible(false);
    this.ok = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => this.advance());
    this.ok.setDepth(500).setAlpha(0.6).disableInteractive();
    this.bubble.disableInteractive();

    this.tweens.add({
      targets: this.client, x: CLIENT_X, duration: 800, ease: 'Sine.easeOut',
      onComplete: () => {
        this.ready = true;
        this.bubble.setVisible(true).setInteractive();
        this.picture.setVisible(true);
        popIn(this, this.bubble);
        popIn(this, this.picture);
        talk(this, this.client, 1500);
        this.ok.setAlpha(1).setInteractive();
      },
    });

    this.addParentZone();
  }

  drawBackground(owned) {
    this.add.image(W / 2, 90, owned.includes('deco:auvent') ? 'deco-auvent' : 'stand-awning').setDepth(40);
    if (owned.includes('deco:guirlande')) this.add.image(W / 2, 90, 'deco-guirlande').setDepth(41);
  }

  drawCoins() {
    const coins = getState().coins;
    this.add.image(W - 250, 60, 'coin').setScale(0.8).setDepth(500);
    this.add.text(W - 175, 60, String(coins), { ...TEXT_STYLE, fontSize: '56px', stroke: '#ffffff', strokeThickness: 8 })
      .setOrigin(0, 0.5).setDepth(500);
  }

  advance() {
    if (!this.ready) return;
    this.ready = false;
    goNext(this);
  }

  addParentZone() {
    let timer = null;
    const cancel = () => {
      if (timer) { timer.remove(false); timer = null; }
    };
    const zone = this.add.zone(0, 0, ZONE, ZONE).setOrigin(0, 0).setDepth(600).setInteractive();
    zone.on('pointerdown', () => {
      cancel();
      timer = this.time.delayedCall(HOLD_MS, () => { timer = null; this.openParentOverlay(); });
    });
    zone.on('pointerup', cancel);
    zone.on('pointerout', cancel);
    this.events.once('shutdown', cancel);
  }

  openParentOverlay() {
    if (this.overlay) return;
    const o = this.add.container(0, 0).setDepth(900);
    this.overlay = o;
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0, 0).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1).fillRoundedRect(W / 2 - 330, H / 2 - 200, 660, 400, 36);
    panel.lineStyle(6, OUTLINE, 1).strokeRoundedRect(W / 2 - 330, H / 2 - 200, 660, 400, 36);
    const title = this.add.text(W / 2, H / 2 - 100, 'Remettre à zéro ?', { ...TEXT_STYLE, fontSize: '54px' }).setOrigin(0.5);
    o.add([dim, panel, title]);
    const button = (x, label, fill, onTap) => {
      const bg = this.add.graphics();
      bg.fillStyle(fill, 1).fillRoundedRect(x - 130, H / 2 + 20, 260, 120, 30);
      bg.lineStyle(5, OUTLINE, 1).strokeRoundedRect(x - 130, H / 2 + 20, 260, 120, 30);
      const t = this.add.text(x, H / 2 + 80, label, { ...TEXT_STYLE, fontSize: '56px', color: '#ffffff', stroke: '#222222', strokeThickness: 8 }).setOrigin(0.5);
      const hit = this.add.zone(x, H / 2 + 80, 260, 120).setInteractive({ useHandCursor: true });
      hit.on('pointerup', onTap);
      o.add([bg, t, hit]);
    };
    button(W / 2 - 150, 'Non', 0xe53935, () => this.closeOverlay());
    button(W / 2 + 150, 'Oui', 0x43a047, () => {
      resetState(getStorage());
      updateState(() => defaultState());
      this.overlay = null;
      restart(this);
    });
  }

  closeOverlay() {
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
  }
}
