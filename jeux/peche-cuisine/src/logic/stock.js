// The cooler: pure functions, inputs are never mutated.
import { maxWeight } from './fish.js';

export const STARTER_STOCK = [
  { color: 'bleu', size: 'petit', weight: 1 },
  { color: 'bleu', size: 'moyen', weight: 3 },
  { color: 'rouge', size: 'petit', weight: 1 },
  { color: 'rouge', size: 'grand', weight: 4 },
];

/** Adds a fish; when the cooler is full the stock is unchanged and the fish is released. */
export function addFish(stock, fish, capacity) {
  if (stock.length >= capacity) return { stock, released: true };
  return { stock: [...stock, fish], released: false };
}

export function removeFish(stock, ids) {
  return stock.filter((f) => !ids.includes(f.id));
}

export function releaseFish(stock, id) {
  return removeFish(stock, [id]);
}

export function ofColor(stock, color) {
  return stock.filter((f) => f.color === color);
}

export function usable(stock, level) {
  const max = maxWeight(level);
  return stock.filter((f) => f.weight <= max);
}
