// Placeholder (Task 7): replaced by the real Shop later.
import { W, H, TOUCH } from '../config.js';
import { addIconButton } from '../ui/button.js';
import { goTo } from '../ui/flow.js';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  create() {
    this.cameras.main.setBackgroundColor(0xfce4ec);
    this.add.image(W / 2, H / 2, 'icon-shop').setDisplaySize(240, 240);
    addIconButton(this, W - 24 - TOUCH / 2, H - 24 - TOUCH / 2, 'icon-ok', () => goTo(this, 'Stand'));
  }
}
