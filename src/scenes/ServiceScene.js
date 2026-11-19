// Service: the cake slides onto the plate on the worktop and the client eats as much of it as the
// score earns (bitesFor: 5/5 eats it all, 0/5 nibbles and pushes the plate away), with mouth
// animation and crumbs. Then the 5 steps are revealed one by one (icon, ok/ko, small "what went
// wrong" picture), the face changes, coins fly into the counter and are saved once (round.paid),
// then icon-next leads to a new client.
import { W, H, TOUCH, COLOR_HEX, OUTLINE } from '../config.js';
import { getRound, getState, updateState } from '../game-state.js';
import { addIconButton } from '../ui/button.js';
import { drawClient } from '../ui/client.js';
import { drawCake, shapeMask, FRAME } from '../ui/cakeView.js';
import { blink, popIn, confetti, talk } from '../ui/fx.js';
import { goNext } from '../ui/flow.js';
import { STEPS, scoreRound, bitesFor } from '../logic/scoring.js';
import { GRID } from '../logic/paint.js';
import { DESSERTS } from '../logic/catalog.js';
import { addCoins } from '../logic/economy.js';

const CLIENT_X = 300;
const CLIENT_Y = 470;
// The plate stands on the worktop (stand-counter top y 540..592), in front of the client.
const CAKE_SIZE = 250;
const CAKE_SCALE = CAKE_SIZE / FRAME; // the plate is drawn with the cake's scale
const PLATE_X = 480;
const BASE_Y = 566; // screen y of the cake's base centre = the plate's well centre
const PLATE_WELL = { x: 240, y: 136 }; // in the 480x280 plate frame
const PLATE_FRAME = { w: 480, h: 280 };
const CAKE_BASE_Y = 264 - FRAME / 2; // cake-frame point (200,264): base centre below the cake centre
const PLATE_Y = BASE_Y + (PLATE_FRAME.h / 2 - PLATE_WELL.y) * CAKE_SCALE;
const CAKE_Y = BASE_Y - CAKE_BASE_Y * CAKE_SCALE;
const FROM_X = PLATE_X + 260; // slides in from behind the result card
const PUSH_X = 46; // 0/5: the plate is pushed away by this much
const CHEW_MS = 520; // mouth animation per bite
const SAFETY_MS = 1800; // per bite: the flow moves on even if a bite never reports back
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
    const { coins, mood } = scoreRound(round.results);
    this.coinsEarned = coins;
    this.cameras.main.setBackgroundColor(0xfffde7);

    this.add.image(W / 2, 90, getState().owned.includes('deco:auvent') ? 'deco-auvent' : 'stand-awning').setDepth(40);
    if (getState().owned.includes('deco:guirlande')) this.add.image(W / 2, 90, 'deco-guirlande').setDepth(41);
    this.client = drawClient(this, CLIENT_X, CLIENT_Y, round.client, 'bof');
    this.client.setDepth(10);
    this.stopBlink = blink(this, this.client);
    this.add.image(W / 2, H - 130, 'stand-counter').setDepth(20);
    this.drawCounter();

    this.plate = this.add.image(FROM_X, PLATE_Y, 'plate').setScale(CAKE_SCALE).setDepth(24);
    this.cake = drawCake(this, FROM_X, CAKE_Y, round.cake, { size: CAKE_SIZE, view: '3q' }).setDepth(25);
    this.card = this.add.graphics().setDepth(30);
    this.card.fillStyle(0xffffff, 1).fillRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 36);
    this.card.lineStyle(6, OUTLINE, 1).strokeRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 36);

    this.next = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-next', () => this.leave());
    this.next.setDepth(500).setVisible(false).disableInteractive();

    // 1. plate + cake slide in, 2. the client eats, 3. reveal steps, 4. face + coins, 5. next
    this.bites = bitesFor(coins);
    this.revealed = false;
    this.tweens.add({
      targets: [this.plate, this.cake], x: PLATE_X, duration: 700, ease: 'Sine.easeOut',
      onComplete: () => this.eat(() => this.time.delayedCall(350, () => this.startReveal(mood))),
    });
    this.events.once('shutdown', () => this.stopBlink?.());
  }

  // Eats this.bites bites one after the other (chewing mouth each time), or nibbles and pushes
  // the plate away at 0. done() runs exactly once, also if a bite never reports back.
  eat(done) {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
    };
    this.time.delayedCall(SAFETY_MS * Math.max(1, this.bites) + 1000, finish);
    if (!this.cake.eat) { finish(); return; } // no shape (cannot happen in play): nothing to eat
    if (this.bites <= 0) {
      talk(this, this.client, 300);
      this.cake.nibble({
        fromLeft: true,
        onDone: () => {
          this.tweens.add({
            targets: [this.plate, this.cake], x: PLATE_X + PUSH_X, duration: 380, ease: 'Back.easeOut',
            onComplete: finish,
          });
        },
      });
      return;
    }
    let left = this.bites;
    const bite = () => {
      if (finished) return;
      if (left-- <= 0) {
        this.addPlateCrumbs();
        finish();
        return;
      }
      talk(this, this.client, CHEW_MS);
      this.cake.eat(1, { onDone: bite, fromLeft: true }); // the client stands on the left
    };
    bite();
  }

  // A few crumb clusters left on the plate (more when the whole cake was eaten).
  addPlateCrumbs() {
    const spots = this.bites >= 4
      ? [[-40, 6, 1, 0], [38, 12, -1, 0.3], [4, -6, 1, -0.2]]
      : [[60, 14, 1, 0.2]];
    for (const [dx, dy, flip, rot] of spots) {
      this.add.image(this.plate.x + dx * CAKE_SCALE * 2, BASE_Y + dy * CAKE_SCALE * 2, 'crumbs')
        .setScale(0.45 * flip, 0.45).setRotation(rot).setDepth(24.5);
    }
  }

  startReveal(mood) {
    if (this.revealed) return;
    this.revealed = true;
    this.reveal(0, mood);
  }

  drawCounter() {
    const base = getState().coins - (this.round.paid ? (this.round.coinsPaid ?? 0) : 0);
    this.shownCoins = base;
    this.add.image(W - 250, 60, 'coin').setScale(0.8).setDepth(500);
    this.coinText = this.add.text(W - 175, 60, String(base), {
      ...TEXT_STYLE, fontSize: '56px', stroke: '#ffffff', strokeThickness: 8,
    }).setOrigin(0, 0.5).setDepth(500);
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
      const pic = this.reasonPicture(step, res ?? {}, REASON_X);
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
    else if (step === 'couleur') this.row(c, o.glaze.map(k => ['pot', COLOR_HEX[k]]), x);
    else this.row(c, o.toppings.map(t => [`topping-${t.key}`, null]), x);
    return c;
  }

  // 1 to 3 small pictures side by side, overlapping, centred on x: [[key, tint|null], ...]
  row(c, items, x) {
    const n = items.length;
    const size = n === 1 ? 84 : n === 2 ? 64 : 54;
    const step = n === 1 ? 0 : n === 2 ? 40 : 34;
    items.forEach(([key, tint], i) => {
      const img = this.fit(key, size, x + (i - (n - 1) / 2) * step);
      if (tint !== null) img.setTint(tint);
      c.add(img);
    });
  }

  // sign: -1, +1, 'x' or 0 (none): a red minus / green plus / red cross badge at the bottom
  // right of the picture.
  badge(c, x, sign) {
    if (!sign) return;
    const g = this.add.graphics();
    const bx = x + 36;
    const by = 30;
    g.fillStyle(sign === 1 ? 0x43a047 : 0xe53935, 1).fillCircle(bx, by, 22);
    g.lineStyle(4, OUTLINE, 1).strokeCircle(bx, by, 22);
    if (sign === 'x') {
      g.lineStyle(7, 0xffffff, 1);
      g.lineBetween(bx - 10, by - 10, bx + 10, by + 10).lineBetween(bx - 10, by + 10, bx + 10, by - 10);
    } else {
      g.fillStyle(0xffffff, 1).fillRect(bx - 12, by - 3, 24, 6);
      if (sign > 0) g.fillRect(bx - 3, by - 12, 6, 24);
    }
    c.add(g);
  }

  miniCake(cake, x) {
    const c = this.add.container(0, 0);
    const inner = drawCake(this, x, 6, cake, { size: 110, view: '3q' });
    c.add(inner);
    return c;
  }

  // res: the step's result ({reason, zone, color, key}).
  reasonPicture(step, res, x) {
    const o = this.round.order;
    const cake = this.round.cake;
    const reason = res.reason;
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
        // toppings 'trop': that kind with a plus
        c.add(this.fit(`topping-${res.key ?? o.toppings[0].key}`, 76, x));
        this.badge(c, x, 1);
        break;
      case 'pas-assez':
        c.add(this.fit(`topping-${res.key ?? o.toppings[0].key}`, 76, x));
        this.badge(c, x, -1);
        break;
      case 'mauvais-topping':
        c.add(this.fit(`topping-${res.key ?? o.toppings[0].key}`, 76, x));
        this.badge(c, x, 'x');
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
        // the pot she used on that zone (the judge says it is not the ordered one)
        const want = o.glaze[res.zone ?? 0];
        const key = res.color && COLOR_HEX[res.color] !== undefined ? res.color
          : Object.keys(COLOR_HEX).find(k => k !== want);
        c.add(this.fit('pot', 80, x).setTint(COLOR_HEX[key]));
        break;
      }
      case 'pas-couvert': {
        // a mini cake only half painted with that zone's colour
        const mask = shapeMask(this, 'rond');
        const cells = new Uint8Array(GRID * GRID);
        for (let n = 0; n < cells.length; n++) if (mask[n] && n % GRID < GRID / 2) cells[n] = 1;
        const color = o.glaze[res.zone ?? 0] ?? o.glaze[0];
        c.add(this.miniCake({ ...base, bake: 'dore', glaze: { cells, size: GRID, colorKeys: [color] } }, x));
        break;
      }
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
