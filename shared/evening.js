export function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s));
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

// Start inclusive, end exclusive; wraps midnight when start > end.
export function isEvening(now, { enabled, start, end }) {
  if (!enabled) return false;
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (Number.isNaN(s) || Number.isNaN(e) || s === e) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  return s < e ? t >= s && t < e : t >= s || t < e;
}
