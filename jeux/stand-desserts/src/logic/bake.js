export const GREEN_MIN = 0.45;
export const GREEN_MAX = 0.70;

export function bakeState(gauge) {
  if (gauge < GREEN_MIN) return 'pale';
  if (gauge > GREEN_MAX) return 'brule';
  return 'dore';
}

export const MAX_DT = 100;
const BASE_RATE = 1 / 10000;
const HEAT_FACTOR = { 2: 3, 1: 2, 0: 1, '-1': 0.5, '-2': 0.25 };

export function bakeRate(heat, target) {
  return BASE_RATE * (HEAT_FACTOR[heat - target] ?? 1);
}

export function createBakeTimer(heat, target) {
  const rate = bakeRate(heat, target);
  let g = 0;
  return {
    tick(dtMs) {
      if (!(dtMs > 0)) return;
      g = Math.min(1, Math.max(0, g + rate * Math.min(dtMs, MAX_DT)));
    },
    gauge() { return g; },
  };
}
