// Service: the cake slides onto the plate on the worktop and the client eats as much of it as the
// score earns (bitesFor: 5/5 eats it all, 0/5 nibbles and pushes the plate away), with mouth
// animation and crumbs. Then the 5 steps are revealed one by one (icon, ok/ko, small "what went
// wrong" picture), the face changes, coins fly into the counter and are saved once (round.paid),
// then icon-next leads to a new client. Each scored phase's result is saved once (round.recorded)
// for the parent's level proposals. At Commande N2 / N3 a card at the bottom repeats the order's
// words / sentence, with the words of the failed points marked. When the dough's quantities were
// wrong, the recipe comes back at the top left: per kind what was needed (with the operation) and
// what she poured.
import { W, H, TOUCH, COLOR_HEX, OUTLINE, BATTER, TOP_SQUASH } from '../config.js';
import { getRound, getState, updateState } from '../game-state.js';
import { addIconButton } from '../ui/button.js';
import { drawClient } from '../ui/client.js';
import { drawCake, shapeMask, FRAME } from '../ui/cakeView.js';
import { blink, popIn, confetti, talk } from '../ui/fx.js';
import { goNext } from '../ui/flow.js';
import { STEPS, scoreRound, bitesFor } from '../logic/scoring.js';
import { GRID } from '../logic/paint.js';
import { zoneEdges } from '../logic/zones.js';
import { INGREDIENTS } from '../logic/catalog.js';
import { fixedRecipe, toPour } from '../logic/recipe.js';
import { addCoins } from '../logic/economy.js';
import { dur } from '../ui/pace.js';
import { orderSentenceParts, orderWordParts, failedElements } from '../logic/orderText.js';
import { ensureWordTextures, flowParts } from '../ui/words.js';
import { recordPhaseResult } from '../../../../shared/runtime.js';
import { ID } from '../../collection.js';

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
const SMALL_BITE = 0.5; // 1-2/5: one small bite (half a quarter of the cake)
const SAFETY_MS = 1800; // per bite: the flow moves on even if a bite never reports back
const CARD_X = 650;
const CARD_Y = 192;
const CARD_W = 590;
const CARD_H = 470;
const ROW_H = 90;
const STEP_MS = 600;
const MINI = 110; // mini cake pictures, px
const SWAP_MINI = 150; // the colour-swap cake: bigger, so each zone's colour reads
const CX = CARD_X + CARD_W / 2; // rows pop in around the card's centre line
const ICON_X = 720;
const STATUS_X = 850;
const REASON_X = 1000;
// Commande N2 / N3 word recap: a card along the bottom, clear of icon-next
const RECAP_LEFT = 30;
const RECAP_RIGHT = W - 24 - TOUCH - 24;
const RECAP_PAD = 14;
// Pâte recap card (top left, over the awning, clear of the coin counter)
const DOUGH_X = 20;
const DOUGH_Y = 14;
const DOUGH_MAX_W = W - 330 - DOUGH_X;
const DOUGH_REASONS = ['intrus', 'manque', 'trop'];
const GOOD = { fill: 0xc8f2c2, line: 0x2e7d32 };
const BAD = { fill: 0xffcdd2, line: 0xc62828 };
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
    this.recordResults();
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

    this.drawWordRecap();
    this.drawDoughRecap();

    this.next = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-next', () => this.leave());
    this.next.setDepth(500).setVisible(false).disableInteractive();

    // 1. plate + cake slide in, 2. the client eats, 3. reveal steps, 4. face + coins, 5. next
    this.bites = bitesFor(coins);
    this.revealed = false;
    // The face follows the eating: the client waits neutral, then eats with the round's mood
    // (a perfect cake is eaten happily, a 0/5 pushed away cross).
    this.tweens.add({
      targets: [this.plate, this.cake], x: PLATE_X, duration: dur(700), ease: 'Sine.easeOut',
      onComplete: () => {
        this.client.setMood(mood);
        this.eat(() => this.time.delayedCall(dur(350), () => this.startReveal(mood)));
      },
    });
    this.events.once('shutdown', () => this.stopBlink?.());
  }

  // Once per round (a restarted scene does not count twice): each step's point, ok or not, for the
  // level proposals (shared/runtime.js keeps only the phases that have levels).
  recordResults() {
    if (this.round.recorded) return;
    this.round.recorded = true;
    for (const step of STEPS) {
      const res = this.round.results[step];
      if (res) recordPhaseResult(ID, step, res.ok === true); // no result: not played (debug entry)
    }
  }

  // Commande N2 / N3: the order as she read it, the words (N2) or the sentence (N3), on a card
  // under the result card. The words tied to a failed point (shape, the failing zone's colour,
  // the topping kind) get a marker once every row is revealed (markWords).
  drawWordRecap() {
    const level = this.round.levels?.commande ?? 1;
    if (level < 2) return;
    ensureWordTextures(this);
    const o = this.round.order;
    const failed = failedElements(o, this.round.results);
    const isFailed = p => failed.some(f => f.kind === p.kind && f.index === p.index);
    const parts = level >= 3 ? orderSentenceParts(o) : orderWordParts(o).map(p => (p.br ? { text: ' ' } : p));
    const width = RECAP_RIGHT - RECAP_LEFT - 2 * RECAP_PAD;
    const text = flowParts(this, parts, { width, fontSize: 28, mark: isFailed });
    const h = text.h + 2 * RECAP_PAD - 4;
    const top = H - 14 - h;
    const bg = this.add.graphics().setDepth(34);
    bg.fillStyle(0x000000, 0.15).fillRoundedRect(RECAP_LEFT + 3, top + 5, RECAP_RIGHT - RECAP_LEFT, h, 24);
    bg.fillStyle(0xffffff, 1).fillRoundedRect(RECAP_LEFT, top, RECAP_RIGHT - RECAP_LEFT, h, 24);
    bg.lineStyle(4, OUTLINE, 1).strokeRoundedRect(RECAP_LEFT, top, RECAP_RIGHT - RECAP_LEFT, h, 24);
    text.setPosition(RECAP_LEFT + RECAP_PAD, top + RECAP_PAD - 2).setDepth(35);
    text.markers.setAlpha(0);
    this.recap = text;
  }

  doughRecipe() {
    return this.round.recipe ?? fixedRecipe(this.round.order.dessert);
  }

  // Pâte failed on quantities: the recipe again, one column per kind (the recipe's, then the
  // intruders she poured). Top line: the ingredient. Middle line (a little recipe card): what she
  // had to pour, with the operation at N2-N3 (« 2 + 1 = 3 », « 7 − 3 = 4 », « 5 × 2 = 10 »), as dice
  // at N1. Bottom line (the bowl): what she poured, green when right, red when not. Fades in with
  // the pâte row.
  drawDoughRecap() {
    const res = this.round.results.pate;
    if (!res || res.ok || !DOUGH_REASONS.includes(res.reason)) return;
    const recipe = this.doughRecipe();
    const added = this.round.doughAdded ?? {};
    const dice = Object.values(recipe.display).every(d => d.kind === 'dice');
    const kinds = Object.keys(recipe.target);
    const extra = Object.keys(added).filter(k => added[k] > 0 && !kinds.includes(k))
      .sort((a, b) => INGREDIENTS.indexOf(a) - INGREDIENTS.indexOf(b));
    const box = this.add.container(DOUGH_X, DOUGH_Y).setDepth(45).setAlpha(0);
    const ICON_Y = 32;
    const NEED_Y = 86;
    const HAVE_Y = 138;
    const pad = 14;
    const gap = 22;
    // row pictograms: a small recipe card, the bowl
    const lead = this.add.container(0, 0);
    const card = this.add.graphics();
    card.fillStyle(0xfff8e1, 1).fillRoundedRect(pad, NEED_Y - 22, 34, 44, 6);
    card.lineStyle(3, OUTLINE, 1).strokeRoundedRect(pad, NEED_Y - 22, 34, 44, 6);
    card.lineStyle(3, 0x9e9e9e, 1);
    for (let l = 0; l < 3; l++) card.lineBetween(pad + 7, NEED_Y - 10 + l * 10, pad + 27, NEED_Y - 10 + l * 10);
    lead.add(card);
    lead.add(this.fit('bowl', 52, pad + 20).setY(HAVE_Y));
    const cols = [...kinds, ...extra].map((k) => {
      const c = this.add.container(0, 0);
      c.add(this.fit(`ing-${k}`, 46, 0).setY(ICON_Y));
      const intruder = !(k in recipe.target);
      const need = intruder ? 0 : toPour(recipe, k);
      let w = 64;
      const needPart = dice && !intruder
        ? this.diceRow(need, NEED_Y)
        : this.recapText(intruder ? '0' : this.operation(recipe, k), NEED_Y);
      c.add(needPart.obj);
      w = Math.max(w, needPart.w);
      const got = added[k] ?? 0;
      const ok = got === need;
      const havePart = dice && got > 0 ? this.diceRow(got, HAVE_Y) : this.recapText(String(got), HAVE_Y);
      const pw = havePart.w + 20;
      const bg = this.add.graphics();
      const col = ok ? GOOD : BAD;
      bg.fillStyle(col.fill, 1).fillRoundedRect(-pw / 2, HAVE_Y - 26, pw, 52, 14);
      bg.lineStyle(4, col.line, 1).strokeRoundedRect(-pw / 2, HAVE_Y - 26, pw, 52, 14);
      c.add(bg);
      c.add(havePart.obj);
      w = Math.max(w, pw);
      return { c, w };
    });
    let x = pad + 34 + gap;
    for (const { c, w } of cols) {
      c.setX(x + w / 2);
      x += w + gap;
    }
    const width = x - gap + pad;
    const height = HAVE_Y + 26 + pad;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.15).fillRoundedRect(3, 5, width, height, 24);
    bg.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, width, height, 24);
    bg.lineStyle(4, OUTLINE, 1).strokeRoundedRect(0, 0, width, height, 24);
    box.add(bg);
    box.add(lead);
    for (const { c } of cols) box.add(c);
    if (width > DOUGH_MAX_W) box.setScale(DOUGH_MAX_W / width);
    this.doughRecap = box;
  }

  // What she had to pour of k, as the card showed it, with the operation and its result.
  operation(recipe, k) {
    const d = recipe.display[k];
    const pre = recipe.prefilled[k] ?? 0;
    const shown = d.kind === 'sum' ? `${d.a} + ${d.b}` : String(d.n);
    let expr = shown;
    if (recipe.double) expr = d.kind === 'sum' ? `(${shown}) × 2` : `${shown} × 2`;
    if (d.kind === 'complement') expr = `${expr} − ${pre}`;
    const result = toPour(recipe, k);
    return expr === String(result) ? expr : `${expr} = ${result}`;
  }

  recapText(str, y) {
    const t = this.add.text(0, y, str, { ...TEXT_STYLE, fontSize: '30px' }).setOrigin(0.5);
    return { obj: t, w: t.width };
  }

  // n (0..10) as one or two die faces (5 + the rest), side by side, centred on x = 0.
  diceRow(n, y) {
    const faces = n > 5 ? [5, n - 5] : [n];
    const size = 48;
    const c = this.add.container(0, 0);
    faces.forEach((f, i) => {
      if (f > 0) c.add(this.add.image((i - (faces.length - 1) / 2) * (size + 6), y, `dice-${f}`).setDisplaySize(size, size));
    });
    return { obj: c, w: faces.length * (size + 6) - 6 };
  }

  markWords() {
    const text = this.recap;
    if (!text?.marked) return;
    this.tweens.add({
      targets: text.markers, alpha: 1, duration: dur(300),
      onComplete: () => this.tweens.add({
        targets: text.markers, alpha: { from: 1, to: 0.55 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      }),
    });
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
    this.time.delayedCall(dur(SAFETY_MS * Math.max(1, this.bites) + 1000), finish);
    if (!this.cake.eat) { finish(); return; } // no shape (cannot happen in play): nothing to eat
    if (this.bites <= 0) {
      talk(this, this.client, 300);
      this.cake.nibble({
        fromLeft: true,
        onDone: () => {
          this.tweens.add({
            targets: [this.plate, this.cake], x: PLATE_X + PUSH_X, duration: dur(380), ease: 'Back.easeOut',
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
      // the client stands on the left; 1-2/5 is one small bite
      this.cake.eat(1, { onDone: bite, fromLeft: true, size: this.coinsEarned <= 2 ? SMALL_BITE : 1 });
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
      this.markWords();
      if (this.coinsEarned === 5) confetti(this);
      this.time.delayedCall(dur(500), () => this.payout());
      return;
    }
    this.buildRow(i);
    if (STEPS[i] === 'pate' && this.doughRecap) this.tweens.add({ targets: this.doughRecap, alpha: 1, duration: dur(300) });
    this.time.delayedCall(dur(STEP_MS), () => this.reveal(i + 1, mood));
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
  // right of the picture (or at `at` = {x, y, r}).
  badge(c, x, sign, at = null) {
    if (!sign) return;
    const g = this.add.graphics();
    const bx = at?.x ?? x + 36;
    const by = at?.y ?? 30;
    const r = at?.r ?? 22;
    const u = r / 22; // cross scale
    g.fillStyle(sign === 1 ? 0x43a047 : 0xe53935, 1).fillCircle(bx, by, r);
    g.lineStyle(4, OUTLINE, 1).strokeCircle(bx, by, r);
    if (sign === 'x') {
      g.lineStyle(7 * u, 0xffffff, 1);
      const d = 10 * u;
      g.lineBetween(bx - d, by - d, bx + d, by + d).lineBetween(bx - d, by + d, bx + d, by - d);
    } else {
      g.fillStyle(0xffffff, 1).fillRect(bx - 12, by - 3, 24, 6);
      if (sign > 0) g.fillRect(bx - 3, by - 12, 6, 24);
    }
    c.add(g);
  }

  miniCake(cake, x, size = MINI) {
    const c = this.add.container(0, 0);
    const inner = drawCake(this, x, 6, cake, { size, view: '3q' });
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
          const recipe = this.doughRecipe();
          const want = k => toPour(recipe, k);
          let key = null;
          let sign = 0;
          if (reason === 'intrus') key = Object.keys(added).find(k => added[k] > 0 && !(k in recipe.target));
          else if (reason === 'manque') { key = Object.keys(recipe.target).find(k => (added[k] ?? 0) < want(k)); sign = -1; }
          else { key = Object.keys(recipe.target).find(k => (added[k] ?? 0) > want(k)); sign = 1; }
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
      case 'pas-melange': {
        // lumpy batter, close up: a batter disc with the lumps filling it
        const g = this.add.graphics();
        g.fillStyle(BATTER, 1).fillEllipse(x, 4, 104, 80);
        g.lineStyle(4, OUTLINE, 1).strokeEllipse(x, 4, 104, 80);
        c.add(g);
        c.add(this.add.image(x - 4, 0, 'lumps').setScale(0.5, 0.42));
        break;
      }
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
        const zone = res.zone ?? 0;
        const want = o.glaze[zone];
        const used = res.color && COLOR_HEX[res.color] !== undefined ? res.color : null;
        if ((used && !o.glaze.includes(used)) || !cake.glaze?.cells) {
          // a colour that is not in the order at all: the pot she used on that zone
          const key = used ?? Object.keys(COLOR_HEX).find(k => k !== want);
          c.add(this.fit('pot', 80, x).setTint(COLOR_HEX[key]));
          break;
        }
        // an ordered colour in the wrong zone (left and right mixed up): her cake as she painted
        // it, in the order's shape, with a cross on the failing zone's front edge (the zone's
        // colour stays visible above it)
        c.add(this.miniCake({ ...base, shape: o.shape, bake: 'dore', glaze: cake.glaze }, x, SWAP_MINI));
        const mask = shapeMask(this, o.shape);
        const edges = [-Infinity, ...zoneEdges(mask, GRID, o.glaze.length), Infinity];
        let minX = GRID;
        let maxX = -1;
        for (let n = 0; n < mask.length; n++) {
          if (!mask[n]) continue;
          minX = Math.min(minX, n % GRID);
          maxX = Math.max(maxX, n % GRID);
        }
        const col = Math.min(maxX, Math.max(minX, Math.floor((Math.max(minX, edges[zone]) + Math.min(maxX + 1, edges[zone + 1])) / 2)));
        let row = 0; // the silhouette's lowest row in that column: the zone's front edge
        for (let y = 0; y < GRID; y++) if (mask[y * GRID + col]) row = y;
        const k = SWAP_MINI / FRAME;
        const fx = (col + 0.5) * (FRAME / GRID) - FRAME / 2;
        const fy = ((row + 1) * (FRAME / GRID) - FRAME / 2) * TOP_SQUASH;
        this.badge(c, x, 'x', { x: x + fx * k, y: 6 + fy * k, r: 14 });
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
      this.time.delayedCall(dur(k * 220), () => {
        const coin = this.add.image(this.client.x + 80, CLIENT_Y - 60, 'coin').setScale(0.6).setDepth(600);
        this.tweens.add({
          targets: coin, x: W - 250, y: 60, scale: 0.8, duration: dur(520), ease: 'Sine.easeIn',
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
