// Browser side of the shared settings: the home and every game read the effective settings
// (pace, evening mode) through this module, never the storage key themselves.
import { loadCollection, saveCollection } from './store.js';
import { effectiveSettings } from './effective.js';

export const CHECK_MS = 60 * 1000;

// localStorage, or null when the browser refuses it (the store then falls back to defaults).
function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getCollection() {
  return loadCollection(storage());
}

export function getEffective(now = new Date()) {
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
