export const HAIRS = 6;
export const HAIR_COLORS = 5;
export const SKINS = 4;
export const SHIRTS = 6;
export const ACCESSORIES = ['glasses', 'cap', 'bow', 'beard', 'moustache', 'earrings'];
export const ANIMALS = ['chat', 'ours', 'lapin', 'chien'];
export const ANIMAL_RATE = 0.2;
export const ACCESSORY_RATE = 0.5;

const int = (n, rng) => Math.floor(rng() * n);

export function sameClient(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'animal') return a.animal === b.animal && a.shirt === b.shirt;
  return a.hair === b.hair && a.hairColor === b.hairColor && a.skin === b.skin
    && a.shirt === b.shirt && a.accessory === b.accessory;
}

function draw(rng) {
  if (rng() < ANIMAL_RATE) {
    return { kind: 'animal', animal: ANIMALS[int(ANIMALS.length, rng)], shirt: int(SHIRTS, rng) };
  }
  return {
    kind: 'human',
    hair: int(HAIRS, rng),
    hairColor: int(HAIR_COLORS, rng),
    skin: int(SKINS, rng),
    shirt: int(SHIRTS, rng),
    accessory: rng() < ACCESSORY_RATE ? ACCESSORIES[int(ACCESSORIES.length, rng)] : null,
  };
}

export function generateClient(rng = Math.random, previous = null) {
  let c;
  do { c = draw(rng); } while (sameClient(c, previous));
  return c;
}
