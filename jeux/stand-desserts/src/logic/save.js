import { starterOwned, itemById } from './catalog.js';

export const STORAGE_KEY = 'standDesserts.v1';

export function defaultState() {
  return { version: 1, coins: 0, owned: starterOwned() };
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
  if (!Array.isArray(data.owned)) return defaultState();
  const owned = [];
  for (const id of [...starterOwned(), ...data.owned]) {
    if (typeof id === 'string' && itemById(id) && !owned.includes(id)) owned.push(id);
  }
  return { version: 1, coins: data.coins, owned };
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
// restored by the back gesture after the parent reset the game on the home must not write its
// old coins back). memory is used only when storage is refused (null).
export function currentState(storage, memory) {
  return storage ? loadState(storage) : (memory ?? defaultState());
}

// Reads the current State, applies fn and saves the result. Returns { state, saved }.
export function updateStored(storage, memory, fn) {
  const state = fn(currentState(storage, memory));
  return { state, saved: storage ? saveState(storage, state) : false };
}
