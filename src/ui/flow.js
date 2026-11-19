// Scene order of one client and fade transitions between scenes.
export const ORDER = ['Stand', 'Dough', 'Mold', 'Bake', 'Paint', 'Toppings', 'Service'];

const FADE_MS = 250;

// Fades out, starts `key` (with optional data), which then fades in.
// Repeated calls while leaving are ignored (double taps).
export function goTo(scene, key, data) {
  if (scene.__leaving) return;
  scene.__leaving = true;
  const cam = scene.cameras.main;
  cam.once('camerafadeoutcomplete', () => {
    const target = scene.scene.get(key);
    target.events.once('create', () => target.cameras.main.fadeIn(FADE_MS));
    scene.scene.start(key, data);
  });
  cam.fadeOut(FADE_MS);
}

// Next step of the round; Service (or any scene outside ORDER) goes back to Stand.
export function goNext(scene) {
  const i = ORDER.indexOf(scene.scene.key);
  const next = i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : ORDER[0];
  goTo(scene, next);
}
