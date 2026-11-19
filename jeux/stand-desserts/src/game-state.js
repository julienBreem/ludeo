// Game State (persisted through logic/save.js) and the current Round.
// The State is always re-read from storage (logic/save.js currentState): the copy kept here is
// only a fallback for a browser that refuses storage, never written over the stored one.
import { currentState, updateStored } from './logic/save.js';
import { generateOrder } from './logic/order.js';
import { createRound } from './logic/round.js';
import { generateClient } from '../../../shared/client.js';

let state = null; // last State read or written (fallback when storage is refused)
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
  state = currentState(getStorage(), state);
  return state;
}

// Applies fn to the stored State (not to an older copy) and saves the result.
export function updateState(fn) {
  state = updateStored(getStorage(), state, fn).state;
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
