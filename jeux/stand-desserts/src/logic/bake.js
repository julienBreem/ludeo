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

// greenFactor (>= 1, calm pace): the gauge crosses the green band that many times slower, so the
// child has longer to react; the time to reach the band is unchanged.
export function createBakeTimer(heat, target, { greenFactor = 1 } = {}) {
  const rate = bakeRate(heat, target);
  const slow = greenFactor > 1 ? greenFactor : 1;
  let g = 0;
  return {
    tick(dtMs) {
      if (!(dtMs > 0)) return;
      let t = Math.min(dtMs, MAX_DT);
      // Piecewise: the rate changes where the gauge enters and leaves the green band.
      while (t > 0 && g < 1) {
        const region = g < GREEN_MIN ? 0 : (g < GREEN_MAX ? 1 : 2);
        const r = region === 1 ? rate / slow : rate;
        const edge = region === 0 ? GREEN_MIN : (region === 1 ? GREEN_MAX : 1);
        const need = (edge - g) / r;
        if (need > t) { g += r * t; break; }
        g = edge;
        t -= need;
        if (region === 2) break;
      }
      g = Math.min(1, Math.max(0, g));
    },
    gauge() { return g; },
  };
}
