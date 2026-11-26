// Persistent State: coins, owned items and the cooler. Storage is the only truth.
import { SIZES } from './fish.js';
import { STARTER_STOCK } from './stock.js';
import { ALL_COLORS } from './setup.js';

export const STORAGE_KEY = 'pecheCuisine.v1';

const ID_PATTERN = /^f\d+$/;

export function defaultState() {
  return {
    version: 1,
    coins: 0,
    owned: [],
    stock: STARTER_STOCK.map((f, i) => ({ id: `f${i + 1}`, ...f })),
    nextFishId: STARTER_STOCK.length + 1,
  };
}

function validFish(f) {
  return !!f && typeof f === 'object'
    && ALL_COLORS.includes(f.color)
    && SIZES.includes(f.size)
    && Number.isInteger(f.weight) && f.weight >= 1 && f.weight <= 10
    && typeof f.id === 'string' && ID_PATTERN.test(f.id);
}

export function loadState(storage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return defaultState();
  }
  if (typeof raw !== 'string') return defaultState();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultState();
  }
  if (!data || typeof data !== 'object' || data.version !== 1) return defaultState();
  if (!Number.isInteger(data.coins) || data.coins < 0) return defaultState();
  if (!Array.isArray(data.owned) || !data.owned.every((o) => typeof o === 'string')) return defaultState();
  if (!Array.isArray(data.stock) || !data.stock.every(validFish)) return defaultState();
  const ids = data.stock.map((f) => f.id);
  if (new Set(ids).size !== ids.length) return defaultState();
  const maxId = ids.reduce((m, id) => Math.max(m, Number(id.slice(1))), 0);
  if (!Number.isInteger(data.nextFishId) || data.nextFishId <= maxId) return defaultState();
  return {
    version: 1,
    coins: data.coins,
    owned: [...data.owned],
    stock: data.stock.map((f) => ({ id: f.id, color: f.color, size: f.size, weight: f.weight })),
    nextFishId: data.nextFishId,
  };
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function resetState(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore: storage unavailable
  }
  return defaultState();
}

// The State to work on. Storage is the only truth: a copy kept in memory can be stale (a page
// restored by the back gesture after the parent reset the game must not write old data back).
// memory is used only when storage is refused (null).
export function currentState(storage, memory) {
  return storage ? loadState(storage) : (memory ?? defaultState());
}

// Reads the current State, applies fn and saves the result. Returns { state, saved }.
export function updateStored(storage, memory, fn) {
  const state = fn(currentState(storage, memory));
  return { state, saved: storage ? saveState(storage, state) : false };
}

/** A new fish with the next id; the fish is not added to the stock. */
export function newFish(state, caught, weight) {
  const fish = { id: `f${state.nextFishId}`, color: caught.color, size: caught.size, weight };
  return { state: { ...state, nextFishId: state.nextFishId + 1 }, fish };
}
