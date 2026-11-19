import { PACES } from './pace.js';
import { parseHHMM } from './evening.js';

export const COLLECTION_KEY = 'collection.v1';

export function defaultCollection() {
  return {
    version: 1,
    profile: null,
    avatar: null,
    pace: 'normal',
    evening: { enabled: false, start: '19:00', end: '07:00' },
    ignored: {},
  };
}

function cleanProfile(p) {
  if (!p || typeof p !== 'object') return null;
  if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) return null;
  if (!Number.isInteger(p.year) || p.year < 1900 || p.year > 2200) return null;
  return { name: typeof p.name === 'string' ? p.name : '', month: p.month, year: p.year };
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
    avatar: data.avatar && typeof data.avatar === 'object' && !Array.isArray(data.avatar) ? data.avatar : null,
    pace: PACES.includes(data.pace) ? data.pace : def.pace,
    evening: cleanEvening(data.evening, def.evening),
    ignored,
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
