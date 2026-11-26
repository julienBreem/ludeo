// The fishing list (what to catch) and the pond spawner. Pure functions.
import { SIZES } from './fish.js';
import { usable } from './stock.js';

export const LIST_LENGTH = 4;
export const ON_LIST_RATE = 0.6;

const SIZE_WEIGHTS = { petit: 0.4, moyen: 0.35, grand: 0.25 };
const NEEDS_PETIT_WEIGHTS = { petit: 0.7, moyen: 0.2, grand: 0.1 };

function pickWeighted(items, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Draws the 4 catches to fish. Favours colours and sizes the cooler lacks. */
export function drawFishingList(stock, level, colors, rng) {
  const have = usable(stock, level);
  const usableCount = (c) => have.filter((x) => x.color === c).length;
  const lacksPetit = (c) => !have.some((x) => x.color === c && x.size === 'petit');

  const list = [];
  for (let i = 0; i < LIST_LENGTH; i++) {
    const weights = colors.map((c) => {
      const listed = list.filter((x) => x.color === c).length;
      return (lacksPetit(c) ? 1.5 : 1) / (1 + usableCount(c) + listed);
    });
    const color = pickWeighted(colors, weights, rng);
    const table = lacksPetit(color) && !list.some((x) => x.color === color && x.size === 'petit')
      ? NEEDS_PETIT_WEIGHTS : SIZE_WEIGHTS;
    list.push({ color, size: pickWeighted(SIZES, SIZES.map((s) => table[s]), rng) });
  }

  // At least one petit, preferably for a colour that has none in the cooler.
  if (!list.some((c) => c.size === 'petit')) {
    const needy = list.map((c, i) => i).filter((i) => lacksPetit(list[i].color));
    const pool = needy.length ? needy : list.map((c, i) => i);
    list[pool[Math.floor(rng() * pool.length)]].size = 'petit';
  }

  return ensureTwoPerColor(list, have);
}

// Each listed colour must reach 2 fish counting list + usable stock, so an
// order of that colour can need an addition. Recolours slots of colours that
// can spare one; sizes are kept, so the petit stays.
function ensureTwoPerColor(list, have) {
  const total = (c) => list.filter((x) => x.color === c).length + have.filter((x) => x.color === c).length;
  const inList = (c) => list.filter((x) => x.color === c).length;
  for (let guard = 0; guard < 20; guard++) {
    const bad = list.map((x) => x.color).find((c) => total(c) < 2);
    if (bad === undefined) return list;
    const donor = list.findIndex((x) => x.color !== bad && (inList(x.color) === 1 || total(x.color) - 1 >= 2));
    if (donor >= 0) {
      list[donor].color = bad;
    } else {
      // No colour can spare a slot: one colour for the whole list always reaches 4.
      for (const x of list) x.color = list[0].color;
    }
  }
  return list;
}

/** Index of the first unfilled slot with the same colour and size, or -1. */
export function matchSlot(list, filled, c) {
  return list.findIndex((s, i) => !filled[i] && s.color === c.color && s.size === c.size);
}

/** A fish appearing in the pond: usually a wanted one, otherwise a decoy. */
export function spawnCatch(list, filled, colors, rng) {
  const free = list.filter((_, i) => !filled[i]);
  if (free.length && rng() < ON_LIST_RATE) {
    const s = free[Math.floor(rng() * free.length)];
    return { color: s.color, size: s.size };
  }
  return {
    color: colors[Math.floor(rng() * colors.length)],
    size: SIZES[Math.floor(rng() * SIZES.length)],
  };
}
