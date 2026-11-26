// Scene order of one round and fade transitions between scenes.
import { commit, fade } from './pace.js';
import { ORDERS_PER_ROUND } from '../logic/orders.js';

export const ORDER = ['Fishing', 'Weigh', 'Kitchen', 'Cut', 'Plate'];

// Phaser reuses scene instances: the "leaving" state must not survive a scene's run.
// It is cleared when the scene shuts down (scene.start of another scene, or restart),
// so every create() starts with a scene that can leave again.
export function isLeaving(scene) {
  return !!scene.__leaving;
}

// Fades out, starts `key` (with optional data), which then fades in.
// Repeated calls while leaving are ignored (double taps).
export function goTo(scene, key, data) {
  if (scene.__leaving) return;
  commit();
  const token = {};
  scene.__leaving = token;
  scene.events.once('shutdown', () => {
    if (scene.__leaving === token) scene.__leaving = null;
  });
  const cam = scene.cameras.main;
  cam.once('camerafadeoutcomplete', () => {
    // Stale callback (the scene was restarted or stopped while fading): do nothing.
    if (scene.__leaving !== token) return;
    const target = scene.scene.get(key);
    target.events.once('create', () => target.cameras.main.fadeIn(fade()));
    scene.scene.start(key, data);
  });
  cam.fadeOut(fade());
}

// Restarts the scene (↺), unless it is already fading out to another scene.
export function restart(scene) {
  if (scene.__leaving) return;
  commit();
  scene.scene.restart();
}

// After the Plate: the next order's Kitchen while orders remain, else the End.
export function nextAfterPlate(round) {
  return round.orderIndex < ORDERS_PER_ROUND ? 'Kitchen' : 'End';
}
