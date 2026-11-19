// Stand: the client walks in and shows the order in one big bubble, at the round's Commande
// level (theme `lecture`, read when the client arrives):
// - N1: the finished cake with a label tag around it for each element (shape, each glaze zone,
//   each kind of topping), a leader line from the tag to the element; tags never cover the cake.
//   Tapping a tag (optional) makes its element glow.
// - N2: the cake for 5 s (x the pace's anim factor), then it fades; the words stay, each row led
//   by a neutral category pictogram; toppings counted in digits.
// - N3: one sentence (numbers in letters); the eye button shows the cake again for 2 s, as often
//   as she likes.
// The bubble grows to its content. At every level only ✓ moves on (the bubble holds tap targets at
// N1 and N3; N2 behaves the same, so the three levels agree).
// The home button (top-left) goes back to the collection home. Reset lives in the home's parent space.
import { W, H, TOUCH, BACKDROP, TOP_SQUASH } from '../config.js';
import { newRound, getState } from '../game-state.js';
import { GRID } from '../logic/paint.js';
import { orderWords, orderSentenceParts } from '../logic/orderText.js';
import { labelLayout, tagHitArea } from '../logic/tagLayout.js';
import { addIconButton } from '../ui/button.js';
import { drawClient } from '../ui/client.js';
import { FRAME } from '../ui/cakeView.js';
import { orderCakeKey, orderGeometry, ORDER_PX } from '../ui/orderCake.js';
import { highlightKey } from '../ui/orderReminder.js';
import { ensureWordTextures, addTag, flowParts, pictKey } from '../ui/words.js';
import { blink, popIn, talk } from '../ui/fx.js';
import { goNext, goTo, isLeaving } from '../ui/flow.js';
import { dur, fade } from '../ui/pace.js';

const CLIENT_X = 360;
const CLIENT_Y = 470;
const K = ORDER_PX / FRAME; // order texture px per frame unit
const CELL = FRAME / GRID;
// The bubble is the 440x340 art as a 9-slice (tail at the lower left, inside the left and bottom
// slices so it keeps its shape); content margins inside it.
const BUBBLE_SLICE = [64, 60, 66, 140];
const PAD = { left: 66, right: 44, top: 40, bottom: 56 };
const BUBBLE_MIN = { w: 380, h: 300 };
const AIM = { x: 880, y: 390 }; // wanted bubble centre
const ROOM = { left: 440, top: 150, right: W - 14, bottom: H - 12 }; // where the bubble may go
// screen px per frame unit of the cake picture, per level
const UNIT = { 1: 0.95, 2: 0.66, 3: 0.8 };
const N2_SHOW_MS = 5000;
const N3_PEEK_MS = 2000;
const GLOW = 0xffc400;
const LEADER = 0x4f6d8f;
const TAG_GAP = 34; // between the cake's box and the tags
const ROW_GAP = 14; // between tags in a row
const TAG_TOUCH = 96; // the least touch target (the tags' hit areas: tests/tagLayout.test.js)
// Relative, so it works from a sub-folder: the game is two levels below the collection home.
const HOME_URL = '../../index.html';
const TEXT_STYLE = { fontFamily: 'Arial Black, Arial, sans-serif', color: '#222222' };

// The bubble for content of these bounds: its centre and size (as close to AIM as ROOM allows) and
// the centre of its content area.
function bubbleFrame(bounds) {
  const w = Math.max(BUBBLE_MIN.w, bounds.right - bounds.left + PAD.left + PAD.right);
  const h = Math.max(BUBBLE_MIN.h, bounds.bottom - bounds.top + PAD.top + PAD.bottom);
  const x = Math.max(Math.min(AIM.x, ROOM.right - w / 2), ROOM.left + w / 2);
  const y = Math.min(Math.max(AIM.y, ROOM.top + h / 2), ROOM.bottom - h / 2);
  return {
    x, y, w, h,
    cx: x - w / 2 + PAD.left + (w - PAD.left - PAD.right) / 2,
    cy: y - h / 2 + PAD.top + (h - PAD.top - PAD.bottom) / 2,
  };
}

export class StandScene extends Phaser.Scene {
  constructor() {
    super('Stand');
  }

  create() {
    const round = newRound();
    const owned = getState().owned;
    this.round = round;
    this.order = round.order;
    this.level = [1, 2, 3].includes(round.levels?.commande) ? round.levels.commande : 1;
    this.ready = false;
    // Phaser reuses this instance for every client and every return from the Shop: every per-run
    // field starts again here (some are only set at one level).
    this.pictureHidden = false;
    this.peeking = false;
    this.peekTimer = null;
    this.glowing = null;
    this.picture = null;
    this.wordBounds = null;
    this.tags = null;
    this.geo = null;
    this.eye = null;
    this.sentence = null;
    this.bubble = null;
    this.inner = null;
    this.box = null;
    ensureWordTextures(this);

    this.drawBackground(owned);
    this.drawCoins();
    addIconButton(this, 24 + TOUCH / 2, H - 24 - TOUCH / 2, 'icon-shop', () => goTo(this, 'Shop')).setDepth(500);
    // Top-left: clear of the shop (bottom-left) and of the coin counter (top-right). No confirmation.
    addIconButton(this, 24 + TOUCH / 2, 24 + TOUCH / 2, 'icon-home', () => this.goHome()).setDepth(500);

    // the order: bubble + its content (built hidden, shown when the client is there)
    const built = this.level === 3 ? this.buildSentence() : this.level === 2 ? this.buildWordList() : this.buildLabels();
    this.placeBubble(built);
    const clientX = Math.min(CLIENT_X, this.bubble.x - this.bubble.width / 2 - 96);

    this.client = drawClient(this, W + 220, CLIENT_Y, round.client, 'content');
    this.client.setDepth(10);
    blink(this, this.client);
    this.add.image(W / 2, H - 130, 'stand-counter').setDepth(20);
    if (owned.includes('deco:pancarte')) {
      this.add.image(230, 585, 'deco-pancarte').setScale(0.7).setDepth(21);
    }

    this.ok = addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => this.advance());
    this.ok.setDepth(500).setAlpha(0.6).disableInteractive();

    this.tweens.add({
      targets: this.client, x: clientX, duration: dur(800), ease: 'Sine.easeOut',
      onComplete: () => {
        this.ready = true;
        this.bubble.setVisible(true);
        this.box.setVisible(true);
        if (this.level === 2) {
          // the picture shows for a while, then only the words stay
          this.time.delayedCall(dur(N2_SHOW_MS), () => this.hidePicture());
        }
        popIn(this, this.bubble);
        popIn(this, this.box);
        talk(this, this.client, 1500);
        this.ok.setAlpha(1).setInteractive();
      },
    });
  }

  // ---- N1: picture + label tags ----------------------------------------------------------------
  buildLabels() {
    const order = this.order;
    const s = UNIT[1];
    const geo = orderGeometry(this, order);
    const box = this.add.container(0, 0);
    const pic = this.add.image(0, 0, orderCakeKey(this, order)).setScale(s / K);
    const lines = this.add.graphics();
    box.add([pic, lines]);
    const bb = { left: geo.bbox.left * s, right: geo.bbox.right * s, top: geo.bbox.top * s, bottom: geo.bbox.bottom * s };
    const items = orderWords(order, 1).map(w => ({ w, tag: addTag(this, 0, 0, w.word, { fontSize: 28, maxWidth: 220 }) }));
    const point = (w) => {
      if (w.kind === 'forme') return { x: geo.shape.x * s, y: geo.shape.y * s };
      if (w.kind === 'couleur') {
        // a colour over several bands (fractions): the middle of its bands
        const zs = (w.bands ?? [w.index]).map(b => geo.zones[b]);
        return { x: (zs.reduce((a, z) => a + z.x, 0) / zs.length) * s, y: (zs.reduce((a, z) => a + z.y, 0) / zs.length) * s };
      }
      return { x: geo.toppings[w.index].x * s, y: geo.toppings[w.index].y * s };
    };
    // the shape on the right, the toppings above, the colours (zones left to right) below
    const shape = items.find(it => it.w.kind === 'forme');
    const toppings = items.filter(it => it.w.kind === 'topping');
    const colours = items.filter(it => it.w.kind === 'couleur');
    const spec = it => ({ want: point(it.w), w: it.tag.w, h: it.tag.h });
    const at = labelLayout(
      { bb, shape: spec(shape), toppings: toppings.map(spec), colours: colours.map(spec) },
      { tagGap: TAG_GAP, rowGap: ROW_GAP },
    );
    // x / y set one by one: setPosition(x, y) would also reset the transform's `w` (0), which is
    // where addTag keeps the tag's width
    const put = (tag, p) => { tag.x = p.x; tag.y = p.y; };
    put(shape.tag, at.shape);
    toppings.forEach((it, i) => put(it.tag, at.toppings[i]));
    colours.forEach((it, i) => put(it.tag, at.colours[i]));
    // leader lines, from the tag's edge facing the cake to a dot on the element
    for (const it of items) {
      const p = point(it.w);
      const t = it.tag;
      const from = it.w.kind === 'forme' ? { x: t.x - t.w / 2 + 6, y: t.y }
        : it.w.kind === 'topping' ? { x: t.x, y: t.y + t.h / 2 - 12 } : { x: t.x, y: t.y - t.h / 2 + 6 };
      lines.lineStyle(7, 0xffffff, 0.9).lineBetween(from.x, from.y, p.x, p.y);
      lines.lineStyle(3.5, LEADER, 1).lineBetween(from.x, from.y, p.x, p.y);
      lines.fillStyle(0xffffff, 1).fillCircle(p.x, p.y, 9);
      lines.fillStyle(LEADER, 1).fillCircle(p.x, p.y, 6);
    }
    // The tags are drawn TAG_MIN_H (64) px tall, but each one is a touch target of at least TAG_TOUCH
    // (96) px: its hit area grows above and below (logic/tagLayout.js tagHitArea; the rows keep
    // ROW_GAP between tags, and the topping row (above the cake) and the colour row (below) are far
    // apart, so no two hit areas overlap: tests/tagLayout.test.js).
    for (const it of items) {
      box.add(it.tag);
      const a = tagHitArea(it.tag.w, it.tag.h, TAG_TOUCH);
      it.tag.setInteractive(new Phaser.Geom.Rectangle(a.x, a.y, a.w, a.h), Phaser.Geom.Rectangle.Contains);
      if (it.tag.input) it.tag.input.cursor = 'pointer';
      it.tag.on('pointerup', () => this.glow(it, geo, s));
    }
    this.picture = pic;
    this.tags = items;
    this.geo = geo;
    const bounds = { ...bb };
    for (const { tag: t } of items) {
      bounds.left = Math.min(bounds.left, t.x - t.w / 2);
      bounds.right = Math.max(bounds.right, t.x + t.w / 2);
      bounds.top = Math.min(bounds.top, t.y - t.h / 2);
      bounds.bottom = Math.max(bounds.bottom, t.y + t.h / 2);
    }
    return { box, bounds };
  }

  // A tapped tag: its element glows three times (and the tag bounces). One glow at a time.
  glow(it, geo, s) {
    if (!this.ready) return;
    this.glowing?.destroy();
    const w = it.w;
    let obj;
    if (w.kind === 'forme') {
      obj = this.add.image(0, 0, highlightKey(this, this.order, 'moule', true)).setScale(s / K);
    } else if (w.kind === 'couleur') {
      obj = this.add.graphics();
      const cells = new Set((w.bands ?? [w.index]).flatMap(b => geo.zones[b].cells));
      const cx = u => (u * CELL - FRAME / 2) * s;
      const cy = v => (v * CELL - FRAME / 2) * TOP_SQUASH * s;
      obj.fillStyle(GLOW, 0.45);
      for (const i of cells) {
        const u = i % GRID;
        const v = Math.floor(i / GRID);
        obj.fillRect(cx(u), cy(v), CELL * s + 0.5, CELL * TOP_SQUASH * s + 0.5);
      }
      obj.lineStyle(5, GLOW, 1);
      for (const i of cells) {
        const u = i % GRID;
        const v = Math.floor(i / GRID);
        if (!cells.has(i - 1) || u === 0) obj.lineBetween(cx(u), cy(v), cx(u), cy(v + 1));
        if (!cells.has(i + 1) || u === GRID - 1) obj.lineBetween(cx(u + 1), cy(v), cx(u + 1), cy(v + 1));
        if (!cells.has(i - GRID)) obj.lineBetween(cx(u), cy(v), cx(u + 1), cy(v));
        if (!cells.has(i + GRID)) obj.lineBetween(cx(u), cy(v + 1), cx(u + 1), cy(v + 1));
      }
    } else {
      obj = this.add.graphics();
      obj.lineStyle(7, GLOW, 1).fillStyle(GLOW, 0.3);
      for (const p of geo.toppings[w.index].spots) {
        obj.fillCircle(p.x * s, (p.y - 34) * s, 48 * s).strokeCircle(p.x * s, (p.y - 34) * s, 48 * s);
      }
    }
    this.inner.addAt(obj, 1); // over the picture, under the leader lines and the tags
    this.glowing = obj;
    obj.setAlpha(0);
    this.tweens.add({
      targets: obj, alpha: 1, duration: dur(260), yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
      onComplete: () => { obj.destroy(); if (this.glowing === obj) this.glowing = null; },
    });
    const t = it.tag;
    this.tweens.killTweensOf(t);
    t.setScale(1);
    this.tweens.add({ targets: t, scale: 1.12, duration: dur(120), yoyo: true, ease: 'Quad.easeOut' });
  }

  // ---- N2: picture for a while + words by category ---------------------------------------------
  buildWordList() {
    const order = this.order;
    const s = UNIT[2];
    const geo = orderGeometry(this, order);
    const box = this.add.container(0, 0);
    const pic = this.add.image(0, 0, orderCakeKey(this, order)).setScale(s / K);
    box.add(pic);
    const bb = { left: geo.bbox.left * s, right: geo.bbox.right * s, top: geo.bbox.top * s, bottom: geo.bbox.bottom * s };
    const words = orderWords(order, 2);
    const PICT = 60;
    const COL_W = 430;
    const x0 = bb.right + 40;
    const tagX0 = x0 + PICT + 14;
    let y = 0;
    const placed = [];
    for (const kind of ['forme', 'couleur', 'topping']) {
      const list = words.filter(w => w.kind === kind);
      if (!list.length) continue;
      const rowTop = y;
      let x = tagX0;
      let lineH = 0;
      for (const w of list) {
        const t = addTag(this, 0, 0, w.word, { fontSize: 26, maxWidth: 250 });
        if (x > tagX0 && x + t.w > x0 + COL_W) { y += lineH + 10; x = tagX0; lineH = 0; }
        t.x = x + t.w / 2;
        t.y = y + t.h / 2;
        x += t.w + 12;
        lineH = Math.max(lineH, t.h);
        placed.push(t);
        box.add(t);
      }
      const pict = this.add.image(x0 + PICT / 2, rowTop + 32, pictKey(kind));
      pict.setScale(PICT / Math.max(pict.width, pict.height));
      box.add(pict);
      placed.push(Object.assign(pict, { w: PICT, h: PICT }));
      y += lineH + 18;
    }
    // the word column is centred on the picture's height
    const colH = y - 18;
    const dy = (bb.top + bb.bottom) / 2 - colH / 2;
    const wb = { left: x0, right: x0, top: Infinity, bottom: -Infinity };
    for (const o of placed) {
      o.y += dy;
      wb.right = Math.max(wb.right, o.x + o.w / 2);
      wb.top = Math.min(wb.top, o.y - o.h / 2);
      wb.bottom = Math.max(wb.bottom, o.y + o.h / 2);
    }
    const bounds = {
      left: bb.left, right: wb.right, top: Math.min(bb.top, wb.top), bottom: Math.max(bb.bottom, wb.bottom),
    };
    this.wordBounds = wb;
    this.picture = pic;
    return { box, bounds };
  }

  hidePicture() {
    if (!this.picture?.active || this.pictureHidden) return;
    this.pictureHidden = true;
    this.tweens.add({
      targets: this.picture, alpha: 0, duration: dur(500), ease: 'Sine.easeIn', onComplete: () => this.shrinkToWords(),
    });
  }

  // ---- N3: one sentence + the eye --------------------------------------------------------------
  buildSentence() {
    const order = this.order;
    const s = UNIT[3];
    const geo = orderGeometry(this, order);
    const box = this.add.container(0, 0);
    const text = flowParts(this, orderSentenceParts(order), { width: 500, fontSize: 34 });
    const picH = (geo.bbox.bottom - geo.bbox.top) * s;
    const h = Math.max(text.h, picH, 110);
    text.y = (h - text.h) / 2;
    const textW = Math.max(text.w, 300);
    const pic = this.add.image(textW / 2, h / 2 - ((geo.bbox.top + geo.bbox.bottom) / 2) * s, orderCakeKey(this, order))
      .setScale(s / K).setAlpha(0).setVisible(false);
    const eyeX = textW + 40 + 52;
    const eye = addIconButton(this, eyeX, h / 2, 'icon-eye', () => this.peek(), { size: 104 });
    box.add([text, pic, eye]);
    this.sentence = text;
    this.picture = pic;
    this.eye = eye;
    return { box, bounds: { left: 0, right: eyeX + 52, top: 0, bottom: h } };
  }

  // The picture instead of the sentence for 2 s (x pace); a new tap starts the 2 s again.
  peek() {
    if (!this.ready) return;
    this.peekTimer?.remove();
    this.tweens.killTweensOf([this.sentence, this.picture]);
    this.picture.setVisible(true);
    this.tweens.add({ targets: this.sentence, alpha: 0, duration: dur(150) });
    this.tweens.add({ targets: this.picture, alpha: 1, duration: dur(150) });
    this.peeking = true;
    this.peekTimer = this.time.delayedCall(dur(N3_PEEK_MS), () => {
      this.peeking = false;
      this.tweens.add({ targets: this.sentence, alpha: 1, duration: dur(200) });
      this.tweens.add({
        targets: this.picture, alpha: 0, duration: dur(200),
        onComplete: () => { if (!this.peeking) this.picture.setVisible(false); },
      });
    });
  }

  // ---- the bubble around the content ------------------------------------------------------------
  // Sizes the 9-slice bubble to the content's bounds (box-local) plus margins, puts it as close to
  // AIM as ROOM allows, and centres the content in it. this.box sits at the content's centre (popIn
  // grows it from there) and holds the built container (this.inner).
  placeBubble({ box, bounds }) {
    const f = bubbleFrame(bounds);
    const [l, r, t, b] = BUBBLE_SLICE;
    // a pale tint on the bubble so a white glaze still stands out from it
    this.bubble = this.add.nineslice(f.x, f.y, 'bubble', undefined, f.w, f.h, l, r, t, b).setDepth(30).setVisible(false);
    this.bubble.setTint(BACKDROP);
    // the built container (`inner`, box-local coordinates kept) inside one centred on the content
    box.setPosition(-(bounds.left + bounds.right) / 2, -(bounds.top + bounds.bottom) / 2);
    this.inner = box;
    this.box = this.add.container(f.cx, f.cy, [box]).setDepth(32).setVisible(false);
  }

  // N2, once the picture is gone: the bubble closes in on the words (same placement rules).
  shrinkToWords() {
    const bounds = this.wordBounds;
    if (!bounds || !this.bubble.active) return;
    const f = bubbleFrame(bounds);
    const midX = (bounds.left + bounds.right) / 2;
    const midY = (bounds.top + bounds.bottom) / 2;
    const size = { w: this.bubble.width, h: this.bubble.height };
    const ms = dur(450);
    this.tweens.add({
      targets: size, w: f.w, h: f.h, duration: ms, ease: 'Sine.easeInOut',
      onUpdate: () => this.bubble.setSize(size.w, size.h),
    });
    this.tweens.add({ targets: this.bubble, x: f.x, y: f.y, duration: ms, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: this.box, x: f.cx - this.inner.x - midX, y: f.cy - this.inner.y - midY, duration: ms, ease: 'Sine.easeInOut',
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
    this.round.started = true; // a played round (ServiceScene saves its results)
    goNext(this);
  }
}
