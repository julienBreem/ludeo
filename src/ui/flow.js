// Scene order of one client and fade transitions between scenes.
export const ORDER = ['Stand', 'Dough', 'Mold', 'Bake', 'Paint', 'Toppings', 'Service'];

const FADE_MS = 250;

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
    target.events.once('create', () => target.cameras.main.fadeIn(FADE_MS));
    scene.scene.start(key, data);
  });
  cam.fadeOut(FADE_MS);
}

// Restarts the scene (↺), unless it is already fading out to another scene.
export function restart(scene) {
  if (scene.__leaving) return;
  scene.scene.restart();
}

// Next step of the round; Service (or any scene outside ORDER) goes back to Stand.
export function goNext(scene) {
  const i = ORDER.indexOf(scene.scene.key);
  const next = i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : ORDER[0];
  goTo(scene, next);
}
