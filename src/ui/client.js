// A client: body, head (or animal), hair, accessory, eyes and mouth share one 300x300 frame
// centred on (x, y). The body is open at the bottom: put the counter in front of it.
// Layer order: body, head|animal, hair, accessory, eyes, mouth. Eyes and mouth are separate
// images so the eyes can blink and the mouth can talk on their own.
const FRAME = 300;
const EYE_Y = 128; // eye line in the frame: blinks squash about it
const MOUTH_Y = 172; // mouth anchor: talking squashes about it

// Palettes, indexed by the Client fields. Hair colours are the *highlight* colour of each hair
// (brown, black, blond, red, grey): provisional, lighter than the wanted mid tone.
export const HAIR_HEX = [0xa0674a, 0x5a5560, 0xf2c96b, 0xe0663a, 0xd8dae2];
export const SKIN_HEX = [0xffffff, 0xf3d2b3, 0xd9a066, 0x9a6444];
export const SHIRT_HEX = [0xff6f91, 0x42a5f5, 0x66bb6a, 0xffca28, 0xab7cf0, 0xff9a4d];

const ACC_TINT = { cap: 'shirt', bow: 'shirt', beard: 'hair', moustache: 'hair' }; // others untinted

// ---- fallback until the v1.1 art is merged: remove this helper then ----------------------------
// Missing layers are skipped; without the eyes or mouth textures the v1 face-<mood> image stands
// in for both (then c.eyes is that face and c.mouth is null).
function faceLayers(scene, mood) {
  const has = k => scene.textures.exists(k);
  if (has('client-eyes-open') && has(`client-mouth-${mood}`)) {
    const eyes = scene.add.image(0, EYE_Y - FRAME / 2, 'client-eyes-open').setOrigin(0.5, EYE_Y / FRAME);
    const mouth = scene.add.image(0, MOUTH_Y - FRAME / 2, `client-mouth-${mood}`).setOrigin(0.5, MOUTH_Y / FRAME);
    return { eyes, mouth, setMood: m => { mouth.setTexture(`client-mouth-${m}`); } };
  }
  const eyes = scene.add.image(0, EYE_Y - FRAME / 2, `face-${mood}`).setOrigin(0.5, EYE_Y / FRAME);
  return { eyes, mouth: null, setMood: m => { eyes.setTexture(`face-${m}`); } };
}
// -------------------------------------------------------------------------------------------------

// container.eyes / container.mouth: the face layers (mouth may be null in the fallback; pass the
// container to blink and talk); container.setMood(m) swaps the mouth; container.bob is the idle bob tween.
export function drawClient(scene, x, y, client, mood = 'content') {
  const has = k => scene.textures.exists(k);
  const shirt = SHIRT_HEX[client.shirt % SHIRT_HEX.length];
  const hairHex = HAIR_HEX[client.hairColor % HAIR_HEX.length];
  const layers = [scene.add.image(0, 0, 'client-body').setTint(shirt)];

  const animalKey = client.kind === 'animal' ? `client-animal-${client.animal}` : null;
  if (animalKey && has(animalKey)) {
    layers.push(scene.add.image(0, 0, animalKey));
  } else {
    // human, or an animal whose art is missing (falls back to a plain human head)
    const skin = client.kind === 'human' ? SKIN_HEX[client.skin % SKIN_HEX.length] : 0xf3d2b3;
    layers.push(scene.add.image(0, 0, 'client-head').setTint(skin));
    if (client.kind === 'human' && client.hair > 0 && has(`client-hair-${client.hair}`)) {
      layers.push(scene.add.image(0, 0, `client-hair-${client.hair}`).setTint(hairHex));
    }
    if (client.kind === 'human' && client.accessory && has(`client-acc-${client.accessory}`)) {
      const img = scene.add.image(0, 0, `client-acc-${client.accessory}`);
      const t = ACC_TINT[client.accessory];
      if (t) img.setTint(t === 'shirt' ? shirt : hairHex);
      layers.push(img);
    }
  }

  const face = faceLayers(scene, mood);
  layers.push(face.eyes);
  if (face.mouth) layers.push(face.mouth);

  const c = scene.add.container(x, y, layers);
  c.setSize(FRAME, FRAME);
  c.client = client;
  c.eyes = face.eyes;
  c.mouth = face.mouth;
  c.setMood = (m) => { face.setMood(m); return c; };
  c.bob = scene.tweens.add({
    targets: layers, y: '-=6', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
  return c;
}
