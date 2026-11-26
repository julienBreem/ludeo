// A round: levels, fishing list, catches, results and the current order.
import { drawFishingList } from './fishing.js';
import { gameSetup } from './setup.js';

/** levels: { peche, pesee, cuisine, decoupe, dressage } numbers, kept as given. */
export function createRound({ levels, state, rng }) {
  const list = drawFishingList(state.stock, levels.cuisine, gameSetup(state).colors, rng);
  return {
    levels,
    list,
    filled: list.map(() => false),
    caught: [],
    results: { peche: true, pesee: true, orders: [] },
    orderIndex: 0,
    order: null,
    chosen: [],
  };
}
