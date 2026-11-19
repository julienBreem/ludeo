// A client: body, head, hair and face share one 300x300 frame centred on (x, y).
// The body is open at the bottom: put the counter in front of it.
const VARIANTS = [
  { hair: 'client-hair-1', skin: 0xffffff, body: 0xff6f91 },
  { hair: 'client-hair-2', skin: 0xd9a066, body: 0x42a5f5 },
  { hair: 'client-hair-3', skin: 0xf3d2b3, body: 0x66bb6a },
  { hair: 'client-hair-1', skin: 0x8d5a3b, body: 0xffca28 },
];
const FRAME = 300;
const EYE_Y = 124; // head centre in the frame: blinks squash about it

// container.face is the face image (pass it to blink); container.setMood(m) swaps it;
// container.bob is the idle bob tween.
export function drawClient(scene, x, y, variant = 0, mood = 'content') {
  const v = VARIANTS[((variant % VARIANTS.length) + VARIANTS.length) % VARIANTS.length];
  const body = scene.add.image(0, 0, 'client-body').setTint(v.body);
  const head = scene.add.image(0, 0, 'client-head').setTint(v.skin);
  const hair = scene.add.image(0, 0, v.hair);
  const face = scene.add.image(0, EYE_Y - FRAME / 2, `face-${mood}`).setOrigin(0.5, EYE_Y / FRAME);
  const c = scene.add.container(x, y, [body, head, hair, face]);
  c.setSize(FRAME, FRAME);
  c.face = face;
  c.variant = v;
  c.setMood = (m) => { face.setTexture(`face-${m}`); return c; };
  c.bob = scene.tweens.add({
    targets: [body, head, hair, face], y: '-=6', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
  return c;
}
