// Placeholder (Task 7): replaced by the real Service step later.
import { H } from '../config.js';
import { getRound } from '../game-state.js';
import { addStepBar } from '../ui/stepBar.js';
import { addOrderReminder } from '../ui/orderReminder.js';
import { drawCake } from '../ui/cakeView.js';
import { goNext } from '../ui/flow.js';
import { sampleCake } from '../debug.js';
import { drawClient } from '../ui/client.js';
import { blink } from '../ui/fx.js';

export class ServiceScene extends Phaser.Scene {
  constructor() {
    super('Service');
  }

  create() {
    this.cameras.main.setBackgroundColor(0xfffde7);
    addOrderReminder(this, getRound().order);
    const client = drawClient(this, 300, 420, getRound().clientVariant ?? 0, 'content');
    blink(this, client.face);
    drawCake(this, 820, H / 2 + 20, sampleCake(this), { size: 360, view: '3q' });
    const bar = addStepBar(this, { onRestart: () => this.scene.restart(), onValidate: () => goNext(this) });
    bar.setValidateEnabled(true);
  }
}
