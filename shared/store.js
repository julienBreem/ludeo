import { PACES } from './pace.js';
import { parseHHMM } from './evening.js';
import { isTheme } from './themes.js';
import { HAIRS, HAIR_COLORS, SKINS, SHIRTS, ACCESSORIES, ANIMALS } from './client.js';

export const COLLECTION_KEY = 'collection.v1';

export function defaultCollection() {
  return {
    version: 1,
    profile: null,
    draftName: '', // first name typed before the birth date (the profile needs both)
    avatar: null,
    pace: 'normal',
    evening: { enabled: false, start: '19:00', end: '07:00' },
    ignored: {},
    levels: {}, // theme id -> 1..3
    overrides: {}, // "<gameId>/<phaseId>" -> 1..3
    history: {}, // "<gameId>/<phaseId>" -> boolean[] (newest last, max 5)
  };
}

const isLevel = n => Number.isInteger(n) && n >= 1 && n <= 3;
const isPhaseKey = k => /^[^/]+\/[^/]+$/.test(k);
const isMap = o => o && typeof o === 'object' && !Array.isArray(o);

function cleanLevels(o) {
  const out = {};
  if (isMap(o)) for (const [k, v] of Object.entries(o)) if (isTheme(k) && isLevel(v)) out[k] = v;
  return out;
}

function cleanOverrides(o) {
  const out = {};
  if (isMap(o)) for (const [k, v] of Object.entries(o)) if (isPhaseKey(k) && isLevel(v)) out[k] = v;
  return out;
}

function cleanHistory(o) {
  const out = {};
  if (isMap(o)) {
    for (const [k, v] of Object.entries(o)) {
      if (isPhaseKey(k) && Array.isArray(v)) out[k] = v.filter(x => typeof x === 'boolean').slice(-5);
    }
  }
  return out;
}

function cleanProfile(p) {
  if (!p || typeof p !== 'object') return null;
  if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) return null;
  if (!Number.isInteger(p.year) || p.year < 1900 || p.year > 2200) return null;
  return { name: typeof p.name === 'string' ? p.name : '', month: p.month, year: p.year };
}

// A Client (shared/client.js) whose every field the avatar's drawing can use, or null.
function cleanAvatar(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const index = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
  if (!index(a.shirt, SHIRTS)) return null;
  if (a.kind === 'animal') return ANIMALS.includes(a.animal) ? { kind: 'animal', animal: a.animal, shirt: a.shirt } : null;
  if (a.kind !== 'human') return null;
  if (!index(a.hair, HAIRS) || !index(a.hairColor, HAIR_COLORS) || !index(a.skin, SKINS)) return null;
  const accessory = a.accessory ?? null;
  if (accessory !== null && !ACCESSORIES.includes(accessory)) return null;
  return { kind: 'human', hair: a.hair, hairColor: a.hairColor, skin: a.skin, shirt: a.shirt, accessory };
}

function cleanEvening(e, def) {
  if (!e || typeof e !== 'object') return def;
  return {
    enabled: typeof e.enabled === 'boolean' ? e.enabled : def.enabled,
    start: typeof e.start === 'string' && !Number.isNaN(parseHHMM(e.start)) ? e.start : def.start,
    end: typeof e.end === 'string' && !Number.isNaN(parseHHMM(e.end)) ? e.end : def.end,
  };
}

export function loadCollection(storage) {
  const def = defaultCollection();
  let raw;
  try {
    raw = storage.getItem(COLLECTION_KEY);
  } catch {
    return def;
  }
  if (typeof raw !== 'string') return def;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return def;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== 1) return def;
  const ignored = {};
  if (data.ignored && typeof data.ignored === 'object' && !Array.isArray(data.ignored)) {
    for (const [k, v] of Object.entries(data.ignored)) if (typeof v === 'string') ignored[k] = v;
  }
  return {
    version: 1,
    profile: cleanProfile(data.profile),
    draftName: typeof data.draftName === 'string' ? data.draftName : def.draftName,
    avatar: cleanAvatar(data.avatar),
    pace: PACES.includes(data.pace) ? data.pace : def.pace,
    evening: cleanEvening(data.evening, def.evening),
    ignored,
    levels: cleanLevels(data.levels),
    overrides: cleanOverrides(data.overrides),
    history: cleanHistory(data.history),
  };
}

export function saveCollection(storage, c) {
  try {
    storage.setItem(COLLECTION_KEY, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}
