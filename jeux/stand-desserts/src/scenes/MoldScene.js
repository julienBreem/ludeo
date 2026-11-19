// Mold: pick one of the owned silicone molds; the batter pours from the bowl and fills it.
import { W, BATTER, OUTLINE, TOP_SQUASH } from '../config.js';
import { getRound, getState } from '../game-state.js';
import { ownedKeys } from '../logic/catalog.js';
import { judgeShape } from '../logic/scoring.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { goNext, restart } from '../ui/flow.js';
import { splash } from '../ui/fx.js';

const CARD = 230;
const STEP = 244;
const CARD_Y = 540;
const MOLD_SCALE = 0.52;
const FILL_MS = 900;
const BOWL_SCALE = 0.34;
const BOWL_Y = 250;

export class MoldScene extends Phaser.Scene {
  constructor() {
    super('Mold');
  }

  create() {
    const round = getRound();
    this.round = round;
    if (window.__game) window.__round = round;
    this.chosen = null;
    this.pouring = false;
    this.cards = {};

    this.cameras.main.setBackgroundColor(0xe1f5fe);
    addOrderReminder(this, round.order, 'moule');

    const keys = ownedKeys(getState().owned, 'shape');
    const x0 = W / 2 - ((keys.length - 1) * STEP) / 2;
    keys.forEach((key, i) => this.addCard(key, x0 + i * STEP));

    this.bowl = this.add.image(W / 2, BOWL_Y, 'bowl').setScale(BOWL_SCALE).setDepth(20).setVisible(false);
    this.stream = this.add.rectangle(0, 0, 30, 100, BATTER).setOrigin(0.5, 0).setDepth(19).setVisible(false);

    this.bar = addStepBar(this, { onRestart: () => restart(this), onValidate: () => this.validate() });
  }

  addCard(key, x) {
    const card = this.add.container(x, CARD_Y);
    const bg = this.add.graphics();
    card.add(bg);
    const drawBg = (selected) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.12).fillRoundedRect(-CARD / 2 + 3, -CARD / 2 + 6, CARD, CARD, 28);
      bg.fillStyle(selected ? 0xfff9c4 : 0xffffff, 1).fillRoundedRect(-CARD / 2, -CARD / 2, CARD, CARD, 28);
      bg.lineStyle(selected ? 10 : 4, selected ? 0x66bb6a : OUTLINE, selected ? 1 : 0.5)
        .strokeRoundedRect(-CARD / 2, -CARD / 2, CARD, CARD, 28);
    };
    drawBg(false);
    const mold = this.add.container(0, 0).setScale(MOLD_SCALE);
    mold.add(this.add.image(0, 0, `mold-${key}-back`));
    const slot = this.add.container(0, 0);
    mold.add(slot);
    mold.add(this.add.image(0, 0, `mold-${key}-front`));
    card.add(mold);
    const zone = this.add.zone(0, 0, CARD, CARD).setInteractive({ useHandCursor: true });
    card.add(zone);
    zone.on('pointerup', () => this.select(key));
    this.cards[key] = { card, slot, drawBg };
  }

  select(key) {
    if (this.pouring || this.chosen === key) return;
    if (this.chosen) this.clear();
    this.chosen = key;
    const c = this.cards[key];
    c.drawBg(true);
    this.tweens.add({ targets: c.card, scale: 1.05, duration: 160, ease: 'Back.easeOut' });
    this.pour(key);
  }

  // Un-fills the chosen mold (restart of the pick, or switching molds).
  clear() {
    const c = this.cards[this.chosen];
    if (!c) return;
    c.drawBg(false);
    this.tweens.add({ targets: c.card, scale: 1, duration: 120 });
    c.slot.removeAll(true);
    this.chosen = null;
    this.bar.setValidateEnabled(false);
  }

  pour(key) {
    this.pouring = true;
    const c = this.cards[key];
    const x = c.card.x;
    const targetY = CARD_Y;
    const bowlY = BOWL_Y;
    const lipY = bowlY + 40;

    const box = this.add.container(0, 0).setScale(0);
    const face = this.add.image(0, 0, `shape-${key}-fill`).setTint(BATTER);
    face.setScale(1, TOP_SQUASH);
    box.add(face);
    const shine = this.add.ellipse(-50, -22, 110, 36, 0xffffff, 0.35);
    box.add(shine);
    if (this.round.cake.doughOk === false) {
      const lumps = this.add.image(0, 0, 'lumps');
      lumps.setScale(1, TOP_SQUASH);
      box.add(lumps);
    }
    c.slot.add(box);

    this.bowl.setPosition(x - 70, bowlY).setAngle(0).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.bowl, angle: -28, x: x - 90, duration: 300, ease: 'Quad.easeOut' });

    this.stream.setPosition(x - 8, lipY).setScale(1, 0).setAlpha(1).setVisible(true);
    this.tweens.add({
      targets: this.stream, scaleY: (targetY - lipY - 10) / 100, duration: 260, delay: 200, ease: 'Quad.easeIn',
      onComplete: () => splash(this, x - 8, targetY - 24, BATTER),
    });
    this.tweens.add({
      targets: box, scaleX: 1, scaleY: 1, duration: FILL_MS, delay: 300, ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: this.stream, alpha: 0, scaleX: 0.2, duration: 200, onComplete: () => this.stream.setVisible(false) });
        this.tweens.add({
          targets: this.bowl, angle: 0, alpha: 0, duration: 300, onComplete: () => this.bowl.setVisible(false),
        });
        this.pouring = false;
        this.bar.setValidateEnabled(true);
      },
    });
  }

  validate() {
    if (!this.chosen) return false;
    this.round.results.moule = judgeShape(this.chosen, this.round.order);
    this.round.cake.shape = this.chosen;
    goNext(this);
  }
}
