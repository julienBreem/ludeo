// Placeholder (Task 7): replaced by the real Bake step later.
import { W, H } from '../config.js';
import { getRound } from '../game-state.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { drawCake } from '../ui/cakeView.js';
import { goNext } from '../ui/flow.js';
import { sampleCake } from '../debug.js';

export class BakeScene extends Phaser.Scene {
  constructor() {
    super('Bake');
  }

  create() {
    this.cameras.main.setBackgroundColor(0xffebee);
    addOrderReminder(this, getRound().order);
    drawCake(this, W / 2, H / 2 + 20, { ...sampleCake(this), glaze: null, toppings: [] }, { size: 400, view: '3q', inMold: true });
    const bar = addStepBar(this, { onRestart: () => this.scene.restart(), onValidate: () => goNext(this) });
    bar.setValidateEnabled(true);
  }
}
