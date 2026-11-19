// ↺ (restart the step) bottom-left and ✓ (lock and move on) bottom-right.
// ✓ locks the bar for good: neither ↺ nor a second ✓ can fire while the scene fades out
// (a second validate() would overwrite the step's result). The bar is rebuilt on every create().
import { W, H, TOUCH } from '../config.js';
import { addIconButton } from './button.js';

const MARGIN = 24;
const OFF_TINT = 0x9e9e9e;

export function addStepBar(scene, { onRestart, onValidate }) {
  const y = H - MARGIN - TOUCH / 2;
  let enabled = false;
  let locked = false;
  const restart = addIconButton(scene, MARGIN + TOUCH / 2, y, 'icon-restart', () => {
    if (locked) return;
    locked = true;
    onRestart?.();
  });
  const validate = addIconButton(scene, W - MARGIN - TOUCH / 2, y, 'icon-ok', () => {
    if (!enabled || locked) return;
    locked = true;
    restart.disableInteractive();
    validate.disableInteractive();
    // onValidate returns false when it refused (nothing recorded, no transition): unlock.
    if (onValidate?.() === false) {
      locked = false;
      restart.setInteractive({ useHandCursor: true });
      validate.setInteractive({ useHandCursor: true });
    }
  });
  restart.setDepth(500);
  validate.setDepth(500);

  // Greyed: grayscale colour matrix (WebGL), tint fallback (Canvas).
  const grey = validate.preFX?.addColorMatrix() ?? null;
  function setValidateEnabled(on) {
    if (locked) return;
    enabled = !!on;
    if (enabled) {
      if (grey) grey.active = false;
      validate.clearTint().setAlpha(1).setInteractive({ useHandCursor: true });
    } else {
      if (grey) { grey.grayscale(1); grey.active = true; } else validate.setTint(OFF_TINT);
      validate.setAlpha(0.6).disableInteractive();
    }
  }
  setValidateEnabled(false);
  return { setValidateEnabled, restartButton: restart, validateButton: validate };
}
