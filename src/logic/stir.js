export const TURNS_NEEDED = 4;
const MIN_RADIUS = 20;
const FULL = Math.PI * 2 * TURNS_NEEDED;

export function createStirTracker(cx, cy) {
  let net = 0;
  let last = null;
  return {
    addPoint(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      if (!(Math.hypot(dx, dy) >= MIN_RADIUS)) { last = null; return; }
      const a = Math.atan2(dy, dx);
      if (last !== null) {
        let d = a - last;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d <= -Math.PI) d += 2 * Math.PI;
        net += d;
      }
      last = a;
    },
    breakStroke() { last = null; },
    progress() { return Math.min(1, Math.abs(net) / FULL); },
    reset() { net = 0; last = null; },
  };
}
