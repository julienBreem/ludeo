// Service: the client gets the cake (3/4), takes a bite, then the 5 steps are revealed one by
// one (icon, ok/ko, small "what went wrong" picture). The face changes, coins fly into the
// counter and are saved once (round.paid), then icon-next leads to a new client.
import { W, H, TOUCH, COLOR_HEX, OUTLINE } from '../config.js';
import { getRound, getState, updateState } from '../game-state.js';
import { addIconButton } from '../ui/button.js';
import { drawClient } from '../ui/client.js';
import { drawCake, shapeMask, FRAME } from '../ui/cakeView.js';
import { blink, popIn, confetti, splash } from '../ui/fx.js';
import { goNext } from '../ui/flow.js';
import { STEPS, scoreRound } from '../logic/scoring.js';
import { dominantColor } from '../logic/paint.js';
import { DESSERTS } from '../logic/catalog.js';
import { addCoins } from '../logic/economy.js';

const CLIENT_X = 300;
const CLIENT_Y = 470;
// The served cake stands on the worktop (y ~545-590), in front of the client, slightly right.
const CAKE_X = 505;
const CAKE_Y = 488;
const CAKE_SIZE = 250;
const CAKE_FROM_X = CAKE_X + 220; // slides in from behind the result card
const BITE_KEY = 'bite-mask';
const CARD_X = 650;
const CARD_Y = 192;
const CARD_W = 590;
const CARD_H = 470;
const ROW_H = 90;
const STEP_MS = 600;
const CX = CARD_X + CARD_W / 2; // rows pop in around the card's centre line
const ICON_X = 720;
const STATUS_X = 850;
const REASON_X = 1000;
const TEXT_STYLE = { fontFamily: 'Arial Black, Arial, sans-serif', color: '#222222' };

export class ServiceScene extends Phaser.Scene {
  constructor() {
    super('Service');
  }

  create() {
    const round = getRound();
    this.round = round;
    if (window.__game) window.__round = round;
    this.leaving = false;
    this.biteGfx = null;
    const { coins, mood } = scoreRound(round.results);
    this.coinsEarned = coins;
    this.cameras.main.setBackgroundColor(0xfffde7);

    this.add.image(W / 2, 90, getState().owned.includes('deco:auvent') ? 'deco-auvent' : 'stand-awning').setDepth(40);
    if (getState().owned.includes('deco:guirlande')) this.add.image(W / 2, 90, 'deco-guirlande').setDepth(41);
    this.client = drawClient(this, CLIENT_X, CLIENT_Y, round.clientVariant ?? 0, 'bof');
    this.client.setDepth(10);
    this.stopBlink = blink(this, this.client.face);
    this.add.image(W / 2, H - 130, 'stand-counter').setDepth(20);
    this.drawCounter();

    this.cake = drawCake(this, CAKE_FROM_X, CAKE_Y, round.cake, { size: CAKE_SIZE, view: '3q' }).setDepth(25);
    this.card = this.add.graphics().setDepth(30);
    this.card.fillStyle(0xffffff, 1).fillRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 36);
    this.card.lineStyle(6, OUTLINE, 1).strokeRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 36);

    this.next = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-next', () => this.leave());
    this.next.setDepth(500).setVisible(false).disableInteractive();

    // 1. hand the cake over, 2. bite, 3. reveal steps, 4. face + coins, 5. next
    this.tweens.add({
      targets: this.cake, x: CAKE_X, duration: 700, ease: 'Sine.easeOut',
      onComplete: () => {
        this.bite();
        this.time.delayedCall(500, () => this.reveal(0, mood));
      },
    });
    this.events.once('shutdown', () => {
      this.stopBlink?.();
      this.biteGfx?.destroy(); // made off the display list: not destroyed by the scene
      this.biteGfx = null;
    });
  }

  drawCounter() {
    const base = getState().coins - (this.round.paid ? (this.round.coinsPaid ?? 0) : 0);
    this.shownCoins = base;
    this.add.image(W - 250, 60, 'coin').setScale(0.8).setDepth(500);
    this.coinText = this.add.text(W - 175, 60, String(base), {
      ...TEXT_STYLE, fontSize: '56px', stroke: '#ffffff', strokeThickness: 8,
    }).setOrigin(0, 0.5).setDepth(500);
  }

  // A round chunk is cut out of the cake's right edge, with a few crumbs.
  // Not a mask on the whole cake: the top face already has a BitmapMask and nested masks hide
  // everything above it in WebGL (toppings, outline). Instead the bite is cut out of the top
  // face's mask texture, and an inverted GeometryMask is put on each unmasked part.
  bite() {
    const cake = this.cake;
    const r = CAKE_SIZE * 0.17;
    const bx = cake.x + CAKE_SIZE * 0.42;
    const by = cake.y;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillCircle(bx, by, r);
    const mask = g.createGeometryMask().setInvertAlpha(true);
    for (const part of [cake.side, cake.line, ...cake.standing]) part?.setMask(mask);
    this.biteGfx = g;
    if (cake.maskImage) {
      // bite centre and radii in the top face's local frame units (cake scale, top squash)
      const s = cake.scaleX;
      const fx = (bx - cake.x) / s / cake.top.scaleX;
      const fy = (by - cake.y) / s / cake.top.scaleY;
      cake.maskImage.setTexture(this.bittenMask(this.round.cake.shape, fx, fy, r / s / cake.top.scaleX, r / s / cake.top.scaleY));
    }
    splash(this, bx, by, 0xd9a066);
  }

  // shape-<shape>-fill with an ellipse erased (frame units, centre-relative): the bitten silhouette.
  bittenMask(shape, fx, fy, rx, ry) {
    const src = this.textures.get(`shape-${shape}-fill`).getSourceImage();
    const w = src.width;
    const h = src.height;
    let tex = this.textures.exists(BITE_KEY) ? this.textures.get(BITE_KEY) : null;
    if (tex && (tex.width !== w || tex.height !== h)) { this.textures.remove(BITE_KEY); tex = null; }
    if (!tex) tex = this.textures.createCanvas(BITE_KEY, w, h);
    const ctx = tex.getContext();
    const k = w / FRAME;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse((fx + FRAME / 2) * k, (fy + FRAME / 2) * k, rx * k, ry * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
    return BITE_KEY;
  }

  reveal(i, mood) {
    if (i >= STEPS.length) {
      this.client.setMood(mood);
      if (this.coinsEarned === 5) confetti(this);
      this.time.delayedCall(500, () => this.payout());
      return;
    }
    this.buildRow(i);
    this.time.delayedCall(STEP_MS, () => this.reveal(i + 1, mood));
  }

  buildRow(i) {
    const step = STEPS[i];
    const res = this.round.results[step];
    const y = CARD_Y + 20 + ROW_H * i + ROW_H / 2;
    const c = this.add.container(CX, y).setDepth(32);
    const inner = this.add.container(-CX, 0);
    c.add(inner);
    inner.add(this.stepIcon(step, ICON_X));
    const ok = !!res?.ok;
    const status = this.add.image(STATUS_X, 0, ok ? 'icon-ok' : 'icon-ko');
    status.setScale(76 / status.width);
    inner.add(status);
    if (!ok) {
      const pic = this.reasonPicture(step, res?.reason, REASON_X);
      if (pic) inner.add(pic);
    }
    c.setScale(1);
    popIn(this, c);
  }

  fit(key, size, x) {
    const img = this.add.image(x, 0, key);
    img.setScale(size / Math.max(img.width, img.height));
    return img;
  }

  stepIcon(step, x) {
    const o = this.round.order;
    const c = this.add.container(0, 0);
    if (step === 'pate') c.add(this.fit('bowl', 84, x));
    else if (step === 'moule') {
      c.add(this.fit(`shape-${o.shape}-fill`, 84, x).setTint(0xe6e6e6));
      c.add(this.fit(`shape-${o.shape}-line`, 84, x));
    } else if (step === 'cuisson') c.add(this.fit('flame', 84, x));
    else if (step === 'couleur') c.add(this.fit('pot', 84, x).setTint(COLOR_HEX[o.color]));
    else c.add(this.fit(`topping-${o.topping}`, 84, x));
    return c;
  }

  // sign: -1, +1 or 0 (none): a red minus / green plus badge at the bottom right of the picture.
  badge(c, x, sign) {
    if (!sign) return;
    const g = this.add.graphics();
    const bx = x + 36;
    const by = 30;
    g.fillStyle(sign < 0 ? 0xe53935 : 0x43a047, 1).fillCircle(bx, by, 22);
    g.lineStyle(4, OUTLINE, 1).strokeCircle(bx, by, 22);
    g.fillStyle(0xffffff, 1).fillRect(bx - 12, by - 3, 24, 6);
    if (sign > 0) g.fillRect(bx - 3, by - 12, 6, 24);
    c.add(g);
  }

  miniCake(cake, x) {
    const c = this.add.container(0, 0);
    const inner = drawCake(this, x, 6, cake, { size: 110, view: '3q' });
    c.add(inner);
    return c;
  }

  reasonPicture(step, reason, x) {
    const o = this.round.order;
    const cake = this.round.cake;
    const c = this.add.container(0, 0);
    const base = { dessert: o.dessert, doughOk: true, shape: 'rond', toppings: [], glaze: null };
    switch (reason) {
      case 'intrus':
      case 'manque':
      case 'trop':
        if (step === 'pate') {
          const added = this.round.doughAdded ?? {};
          const recipe = DESSERTS[o.dessert].recipe;
          let key = null;
          let sign = 0;
          if (reason === 'intrus') key = Object.keys(added).find(k => added[k] > 0 && !(k in recipe));
          else if (reason === 'manque') { key = Object.keys(recipe).find(k => (added[k] ?? 0) < recipe[k]); sign = -1; }
          else { key = Object.keys(recipe).find(k => (added[k] ?? 0) > recipe[k]); sign = 1; }
          c.add(this.fit(key ? `ing-${key}` : 'bowl', 76, x));
          if (key) this.badge(c, x, sign);
          break;
        }
        c.add(this.fit(`topping-${o.topping}`, 76, x));
        this.badge(c, x, reason === 'trop' ? 1 : 0);
        break;
      case 'pas-melange':
        c.add(this.fit('lumps', 84, x));
        break;
      case 'mauvaise-forme': {
        const shape = cake.shape ?? o.shape;
        c.add(this.fit(`shape-${shape}-fill`, 80, x).setTint(0xe6e6e6));
        c.add(this.fit(`shape-${shape}-line`, 80, x));
        break;
      }
      case 'pale':
      case 'brule':
        c.add(this.miniCake({ ...base, bake: reason }, x));
        break;
      case 'mauvaise-couleur': {
        // the pot she mostly painted with (the judge says it is not the ordered one)
        const gl = cake.glaze;
        const painted = gl ? dominantColor(gl.cells, gl.colorKeys) : null;
        const key = painted && painted !== o.color ? painted : Object.keys(COLOR_HEX).find(k => k !== o.color);
        c.add(this.fit('pot', 80, x).setTint(COLOR_HEX[key]));
        break;
      }
      case 'pas-couvert': {
        const mask = shapeMask(this, 'rond');
        const size = 64;
        const cells = new Uint8Array(size * size);
        for (let n = 0; n < cells.length; n++) if (mask[n] && n % size < size / 2) cells[n] = 1;
        c.add(this.miniCake({ ...base, bake: 'dore', glaze: { cells, size, colorKeys: [o.color] } }, x));
        break;
      }
      case 'mauvais-topping': {
        const used = cake.toppings?.find(t => t.key !== o.topping)?.key ?? o.topping;
        c.add(this.fit(`topping-${used}`, 76, x));
        break;
      }
      case 'pas-assez':
        c.add(this.fit(`topping-${o.topping}`, 76, x));
        this.badge(c, x, -1);
        break;
      default:
        return null;
    }
    return c;
  }

  payout() {
    const n = this.coinsEarned;
    if (n > 0 && !this.round.paid) {
      this.round.paid = true;
      this.round.coinsPaid = n;
      updateState(s => addCoins(s, n));
    }
    if (n === 0) return this.showNext();
    let landed = 0;
    for (let k = 0; k < n; k++) {
      this.time.delayedCall(k * 220, () => {
        const coin = this.add.image(this.client.x + 80, CLIENT_Y - 60, 'coin').setScale(0.6).setDepth(600);
        this.tweens.add({
          targets: coin, x: W - 250, y: 60, scale: 0.8, duration: 520, ease: 'Sine.easeIn',
          onComplete: () => {
            coin.destroy();
            this.shownCoins++;
            this.coinText.setText(String(this.shownCoins));
            this.tweens.add({ targets: this.coinText, scale: { from: 1.25, to: 1 }, duration: 150 });
            if (++landed === n) this.showNext();
          },
        });
      });
    }
  }

  showNext() {
    this.next.setVisible(true).setInteractive();
    popIn(this, this.next);
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    goNext(this);
  }
}
