// A client: body, head (or animal), hair, accessory, eyes and mouth share one 300x300 frame
// centred on (x, y). The body is open at the bottom: put the counter in front of it.
// Layer order: body, head|animal, hair, accessory, eyes, mouth. Eyes and mouth are separate
// images so the eyes can blink and the mouth can talk on their own.
const FRAME = 300;
const EYE_Y = 128; // eye line in the frame: blinks squash about it
const MOUTH_Y = 172; // mouth anchor: talking squashes about it

// Palettes, indexed by the Client fields (illustrator's values, art-geometry notes v1.1).
// Hair colours are the *highlight* colour of each hair (brown, black, blond, red, grey): the hair
// art has white highlights, so the multiply tint sets them. Skins stay greyish (the head is
// drawn orange already).
export const HAIR_HEX = [0xa9673a, 0x3d3944, 0xffd866, 0xf07a35, 0xcfd2dc];
export const SKIN_HEX = [0xffffff, 0xeccbb0, 0xc9a58f, 0x9c7a66];
export const SHIRT_HEX = [0xff6f91, 0x42a5f5, 0x66bb6a, 0xffca28, 0xab7cf0, 0xff9a4d];

// cap and bow: shirt colour; beard and moustache: hair colour; the others are not tinted
const ACC_TINT = { cap: 'shirt', bow: 'shirt', beard: 'hair', moustache: 'hair' };

// container.eyes / container.mouth: the face layers (pass the container to blink and talk);
// container.setMood(m) swaps the mouth; container.bob is the idle bob tween.
export function drawClient(scene, x, y, client, mood = 'content') {
  const shirt = SHIRT_HEX[client.shirt % SHIRT_HEX.length];
  const hairHex = HAIR_HEX[client.hairColor % HAIR_HEX.length];
  const layers = [scene.add.image(0, 0, 'client-body').setTint(shirt)];

  if (client.kind === 'animal') {
    layers.push(scene.add.image(0, 0, `client-animal-${client.animal}`));
  } else {
    layers.push(scene.add.image(0, 0, 'client-head').setTint(SKIN_HEX[client.skin % SKIN_HEX.length]));
    if (client.hair > 0) layers.push(scene.add.image(0, 0, `client-hair-${client.hair}`).setTint(hairHex));
    if (client.accessory) {
      const img = scene.add.image(0, 0, `client-acc-${client.accessory}`);
      const t = ACC_TINT[client.accessory];
      if (t) img.setTint(t === 'shirt' ? shirt : hairHex);
      layers.push(img);
    }
  }

  const eyes = scene.add.image(0, EYE_Y - FRAME / 2, 'client-eyes-open').setOrigin(0.5, EYE_Y / FRAME);
  const mouth = scene.add.image(0, MOUTH_Y - FRAME / 2, `client-mouth-${mood}`).setOrigin(0.5, MOUTH_Y / FRAME);
  layers.push(eyes, mouth);

  const c = scene.add.container(x, y, layers);
  c.setSize(FRAME, FRAME);
  c.client = client;
  c.eyes = eyes;
  c.mouth = mouth;
  c.setMood = (m) => { mouth.setTexture(`client-mouth-${m}`); return c; };
  c.bob = scene.tweens.add({
    targets: layers, y: '-=6', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
  return c;
}
