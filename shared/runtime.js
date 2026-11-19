// Browser side of the shared settings: the home and every game read the effective settings
// (pace, evening mode) through this module, never the storage key themselves.
import { loadCollection, saveCollection } from './store.js';
import { effectiveSettings } from './effective.js';
import { GAMES } from '../jeux/registry.js';
import { phaseLevel, isLevel } from './difficulty.js';
import { recordResult } from './history.js';

export const CHECK_MS = 60 * 1000;

// localStorage, or null when the browser refuses it (the store then falls back to defaults).
function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function debugParams() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    return q.has('debug') ? q : null;
  } catch {
    return null;
  }
}

export function getCollection() {
  return loadCollection(storage());
}

// The clock. Debug only: a page opened with ?debug&now=YYYY-MM-DDTHH:MM (local time) sees that
// time, to check the evening look without waiting. ?now= alone is ignored, so a shared or saved
// link cannot change the time by accident. Otherwise it is the real clock.
export function clock() {
  try {
    // URLSearchParams: a URL built by script has the ':' encoded as %3A
    const v = debugParams()?.get('now');
    if (v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  } catch { /* no location: real clock */ }
  return new Date();
}

export function getEffective(now = clock()) {
  return effectiveSettings(getCollection(), now);
}

// Calls cb(effective) when the pace or the evening state changes, checked every 60 s
// (evening starts/ends with the clock; the parent may also change settings on the home).
// Returns a function that stops the checks.
export function onEffectiveChange(cb) {
  let last = getEffective();
  const id = setInterval(() => {
    const now = getEffective();
    if (now.pace === last.pace && now.evening === last.evening) return;
    last = now;
    cb(now);
  }, CHECK_MS);
  return () => clearInterval(id);
}

// Applies fn to the stored collection and saves the result. Returns the new collection.
export function updateCollection(fn) {
  const next = fn(getCollection());
  saveCollection(storage(), next);
  return next;
}

const phasesOf = gameId => GAMES.find(g => g.id === gameId)?.phases ?? [];

// Debug only: ?debug&level=<phase>:<n>,... forces those phases' levels (1..3) for this page, without
// saving anything. Unknown phases and bad levels are ignored; ?level= alone is ignored.
function debugLevels(phases) {
  const v = debugParams()?.get('level');
  const out = {};
  if (!v) return out;
  for (const part of v.split(',')) {
    const [id, n] = part.split(':');
    if (phases.some(p => p.id === id) && isLevel(Number(n))) out[id] = Number(n);
  }
  return out;
}

// The level of each phase of a game as the parent set it: { [phaseId]: 1|2|3 }. A phase that is
// not educational yet (`levels: 1`) always plays level 1, whatever its theme says.
export function storedPhaseLevels(gameId) {
  const c = getCollection();
  const out = {};
  for (const p of phasesOf(gameId)) out[p.id] = Math.min(phaseLevel(c, gameId, p), p.levels ?? 3);
  return out;
}

// The level of each phase of a game, for the next client: the stored levels, with the debug
// overrides of ?debug&level= on top.
export function phaseLevels(gameId) {
  return { ...storedPhaseLevels(gameId), ...debugLevels(phasesOf(gameId)) };
}

// Saves a phase's result (its point at Service) for the parent's proposals. Nothing for a phase
// that is not educational yet (`levels: 1`), has no point of its own (`scored: false`) or is unknown,
// and nothing when the round was not played at the phase's stored level (`playedLevel`: the level
// the round kept when the client arrived): a ?debug&level= round, or a round under way while the
// parent changed the level (that change started a new history, which this round does not belong to).
export function recordPhaseResult(gameId, phaseId, ok, playedLevel) {
  const p = phasesOf(gameId).find(x => x.id === phaseId);
  if (!p || p.levels === 1 || p.scored === false) return false;
  if (playedLevel !== storedPhaseLevels(gameId)[phaseId]) return false;
  updateCollection(c => recordResult(c, gameId, phaseId, ok));
  return true;
}
