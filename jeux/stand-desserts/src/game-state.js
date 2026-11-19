// In-memory game State (persisted through logic/save.js) and the current Round.
import { loadState, saveState } from './logic/save.js';
import { generateOrder } from './logic/order.js';
import { createRound } from './logic/round.js';
import { generateClient } from '../../../shared/client.js';


let state = null;
let round = null;

// localStorage, or null when the browser refuses access (private mode, blocked storage).
export function getStorage() {
  try {
    const s = window.localStorage;
    if (!s) return null;
    s.getItem('standDesserts.probe');
    return s;
  } catch {
    return null;
  }
}

export function getState() {
  if (!state) state = loadState(getStorage());
  return state;
}

// Applies fn to the current State, keeps the result and saves it.
export function updateState(fn) {
  state = fn(getState());
  saveState(getStorage(), state);
  return state;
}

// A fresh Round for a new client: order from owned items + client look.
export function newRound() {
  const previous = round?.client ?? null;
  round = createRound(generateOrder(getState().owned));
  round.client = generateClient(Math.random, previous);
  return round;
}

export function getRound() {
  return round ?? newRound();
}

// Replaces the current Round (debug entry, tests).
export function setRound(r) {
  round = r;
  return round;
}
