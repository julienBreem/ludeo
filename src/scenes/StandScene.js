// Placeholder (Task 7): replaced by the real Stand (order taking) later.
import { W, H, TOUCH } from '../config.js';
import { newRound } from '../game-state.js';
import { addIconButton } from '../ui/button.js';
import { drawClient } from '../ui/client.js';
import { blink } from '../ui/fx.js';
import { goNext } from '../ui/flow.js';

export class StandScene extends Phaser.Scene {
  constructor() {
    super('Stand');
  }

  create() {
    const round = newRound();
    this.add.image(W / 2, 90, 'stand-awning');
    const client = drawClient(this, W / 2, 470, round.clientVariant, 'content');
    blink(this, client.face);
    this.add.image(W / 2, H - 130, 'stand-counter');
    addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => goNext(this));
  }
}
