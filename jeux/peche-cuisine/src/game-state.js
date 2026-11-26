// Game State (persisted through logic/save.js) and the current Round.
// The State is always re-read from storage (logic/save.js currentState): the copy kept here is
// only a fallback for a browser that refuses storage, never written over the stored one.
import { currentState, updateStored } from './logic/save.js';
import { createRound } from './logic/round.js';
import { phaseLevels } from '../../../shared/runtime.js';
import { ID, PHASES } from '../collection.js';

let state = null; // last State read or written (fallback when storage is refused)
let round = null;

// localStorage, or null when the browser refuses access (private mode, blocked storage).
export function getStorage() {
  try {
    const s = window.localStorage;
    if (!s) return null;
    s.getItem('pecheCuisine.probe');
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

// A fresh Round: the levels are read now and kept until the end of the round (a change in the
// parent space applies to the next round). Lot 1 plays level 1 only, so each phase is clamped to 1.
export function newRound() {
  const stored = phaseLevels(ID);
  const levels = {};
  for (const p of PHASES) levels[p.id] = Math.min(stored[p.id] ?? 1, 1);
  round = createRound({ levels, state: getState(), rng: Math.random });
  return round;
}

export function getRound() {
  return round ?? newRound();
}
