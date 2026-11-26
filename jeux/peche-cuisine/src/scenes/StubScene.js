// Placeholder scene of lot 1: its name in small grey text, a ✓ going to the next scene and the
// home button. The real scenes replace the subclasses one by one.
import { W, H, TOUCH } from '../config.js';
import { addIconButton } from '../ui/button.js';
import { goTo } from '../ui/flow.js';

const HOME_URL = '../../index.html';

export class StubScene extends Phaser.Scene {
  // key: this scene; next: the scene the ✓ goes to.
  constructor(key, next) {
    super(key);
    this.nextKey = next;
  }

  create() {
    this.cameras.main.setBackgroundColor('#4dbbe8');
    this.add.text(W / 2, 40, this.scene.key, { fontFamily: 'sans-serif', fontSize: '24px', color: '#777777' }).setOrigin(0.5);
    addIconButton(this, 24 + TOUCH / 2, 24 + TOUCH / 2, 'icon-home', () => this.goHome()).setDepth(500);
    addIconButton(this, W / 2, H / 2, 'icon-ok', () => goTo(this, this.nextKey));
  }

  // Fades out, then opens the collection home (the game is two levels below it).
  goHome() {
    if (this.__leaving) return;
    this.__leaving = {};
    this.cameras.main.once('camerafadeoutcomplete', () => { window.location.href = HOME_URL; });
    this.cameras.main.fadeOut(250);
  }
}
