// Stand: the client walks in and shows the order as the finished cake in one big bubble.
// The home button (top-left) goes back to the collection home. Reset lives in the home's parent space.
import { W, H, TOUCH, BACKDROP } from '../config.js';
import { newRound, getState } from '../game-state.js';
import { addIconButton } from '../ui/button.js';
import { drawClient } from '../ui/client.js';
import { orderCakeKey } from '../ui/orderCake.js';
import { blink, popIn, talk } from '../ui/fx.js';
import { goNext, goTo, isLeaving } from '../ui/flow.js';
import { dur, fade } from '../ui/pace.js';

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
// Relative, so it works from a sub-folder: the game is two levels below the collection home.
const HOME_URL = '../../index.html';
const TEXT_STYLE = { fontFamily: 'Arial Black, Arial, sans-serif', color: '#222222' };

export class StandScene extends Phaser.Scene {
  constructor() {
    super('Stand');
  }

  create() {
    const round = newRound();
    const owned = getState().owned;
    this.ready = false;

    this.drawBackground(owned);
    this.drawCoins();
    addIconButton(this, 24 + TOUCH / 2, H - 24 - TOUCH / 2, 'icon-shop', () => goTo(this, 'Shop')).setDepth(500);
    // Top-left: clear of the shop (bottom-left) and of the coin counter (top-right). No confirmation.
    addIconButton(this, 24 + TOUCH / 2, 24 + TOUCH / 2, 'icon-home', () => this.goHome()).setDepth(500);

    this.client = drawClient(this, W + 220, CLIENT_Y, round.client, 'content');
    this.client.setDepth(10);
    blink(this, this.client);
    this.add.image(W / 2, H - 130, 'stand-counter').setDepth(20);
    if (owned.includes('deco:pancarte')) {
      this.add.image(230, 585, 'deco-pancarte').setScale(0.7).setDepth(21);
    }

    // bubble, picture, validate button
    // a pale tint on the bubble so a white glaze still stands out from it
    this.bubble = this.add.image(BUBBLE_X, BUBBLE_Y, 'bubble').setScale(BUBBLE_SCALE).setDepth(30).setVisible(false)
      .setTint(BACKDROP);
    this.bubble.setInteractive({ useHandCursor: true });
    this.bubble.on('pointerup', () => this.advance());
    // the finished cake of the order, in one big bubble (cached texture, no mask)
    this.picture = this.add.image(CONTENT_X, CONTENT_Y - 14, orderCakeKey(this, round.order))
      .setScale(PICTURE_SCALE).setDepth(32).setVisible(false);
    this.ok = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => this.advance());
    this.ok.setDepth(500).setAlpha(0.6).disableInteractive();
    this.bubble.disableInteractive();

    this.tweens.add({
      targets: this.client, x: CLIENT_X, duration: dur(800), ease: 'Sine.easeOut',
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

  // Fades out (like every scene change, at the pace's speed), then opens the collection home.
  // Coming back with the back gesture reloads the game (main.js), so the fade never stays.
  goHome() {
    if (isLeaving(this)) return;
    this.__leaving = true; // goTo and repeated taps are ignored from now on
    this.ready = false;
    this.cameras.main.once('camerafadeoutcomplete', () => { window.location.href = HOME_URL; });
    this.cameras.main.fadeOut(fade());
  }

  advance() {
    if (!this.ready) return;
    this.ready = false;
    goNext(this);
  }
}
