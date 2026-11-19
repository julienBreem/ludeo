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

// The clock. Debug only: a page opened with ?debug&now=YYYY-MM-DDTHH:MM (local time) sees that
// time, to check the evening look without waiting. ?now= alone is ignored, so a shared or saved
// link cannot change the time by accident. Otherwise it is the real clock.
export function clock() {
  try {
    // URLSearchParams: a URL built by script has the ':' encoded as %3A
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    const v = q.has('debug') ? q.get('now') : null;
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
