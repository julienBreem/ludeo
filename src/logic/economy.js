import { itemById } from './catalog.js';

export function addCoins(state, n) {
  return { ...state, coins: state.coins + n };
}

export function canBuy(state, id) {
  const item = itemById(id);
  return !!item && !state.owned.includes(id) && state.coins >= item.price;
}

export function buy(state, id) {
  if (!canBuy(state, id)) return null;
  return { ...state, coins: state.coins - itemById(id).price, owned: [...state.owned, id] };
}
