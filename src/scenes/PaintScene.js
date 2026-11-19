// Placeholder (Task 7): replaced by the real Paint step later.
import { W, H } from '../config.js';
import { getRound } from '../game-state.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { drawCake } from '../ui/cakeView.js';
import { goNext } from '../ui/flow.js';
import { sampleCake } from '../debug.js';

export class PaintScene extends Phaser.Scene {
  constructor() {
    super('Paint');
  }

  create() {
    this.cameras.main.setBackgroundColor(0xf3e5f5);
    addOrderReminder(this, getRound().order);
    drawCake(this, W / 2, H / 2 + 20, sampleCake(this), { size: 480, view: 'top' });
    const bar = addStepBar(this, { onRestart: () => this.scene.restart(), onValidate: () => goNext(this) });
    bar.setValidateEnabled(true);
  }
}
