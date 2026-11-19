import { DESSERTS } from './catalog.js';

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
  return BASE_RATE * heatFactor(heat, target);
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

// ---- Levels (theme `temps`) -------------------------------------------------------------------
// N1: the gauge above, on a round timer with a green sector. N2: a timer numbered 1..5, bake until
// the dessert's number. N3: a clock; she sets the alarm to the start time + the duration.
// N2 and N3 measure TIME (the hand shows the time gone by), the cake cooks by time x heat factor.
// The rule for her (heat and time judged apart, so two mistakes never cancel out): the cake is
// golden only with the right flames AND the right time. Wrong flames are never golden: too few
// leave it pale, too many burn it, whatever the time, unless the time alone already gives the
// other look (out far too early: pale; far too late: burnt). With the right flames the time
// decides: too early pale, too late burnt. (timedGauge / judgeTimed)
// Windows: N2 leans late (a child waits to SEE the hand on the number): [n - 0.2, n + 0.5] x
// greenWindow; N3 is symmetric, start + duration ± CLOCK_TOL x greenWindow. Pace calme also slows
// the hand (one number = NUMBER_UNIT_MS x anim, one hour = HOUR_MS x anim).

export function heatFactor(heat, target) {
  return HEAT_FACTOR[heat - target] ?? 1;
}

// N2: the number to bake until, per dessert.
export const LEVEL_NUMBERS = { cupcake: 2, gateau: 3, tarte: 4 };
// Invisible tolerance, of a number: before / after it. NUMBER_LATE x the largest greenWindow (1.5)
// stays under 1, so the next number is always wrong.
export const NUMBER_EARLY = 0.2;
export const NUMBER_LATE = 0.5;
export const NUMBER_UNIT_MS = 3000; // one number on the dial, at any heat, x the pace anim factor
export const NUMBER_MAX = 5; // the hand stops on the 5 (the timer art runs 300°: 0..5)
// N3: hours. CLOCK_TOL x the largest greenWindow stays under ½ h, so an alarm set ½ h off is
// always wrong.
export const CLOCK_TOL = 0.3;
export const HOUR_MS = 6000; // x the pace anim factor
export const CLOCK_EXTRA = 2; // hours past the duration before the oven stops by itself
export const START_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // start + duration never passes 12
// ½ h durations and half-hour alarm steps: off until the parent decides (debug: ?debug&half=1).
export const HALF_HOURS = false;

// What the bake asks for at a level (1..3), heat included (the flames card, all levels).
// N3 draws the start time with rng; the scene keeps the target on the round (a ↺ keeps it).
export function bakeTarget(dessert, level, { rng = Math.random, halfHours = HALF_HOURS } = {}) {
  const heat = DESSERTS[dessert].heat;
  if (level === 2) return { kind: 'number', level: 2, heat, number: LEVEL_NUMBERS[dessert] };
  if (level === 3) {
    const start = START_HOURS[Math.min(START_HOURS.length - 1, Math.floor(rng() * START_HOURS.length))];
    const duration = halfHours && rng() < 0.5 ? 0.5 : 1;
    return { kind: 'clock', level: 3, heat, start, duration, halfHours: !!halfHours };
  }
  return { kind: 'sector', level: 1, heat };
}

// The judgement window of a target, in its own unit (gauge / number / hours): {lo, hi, center, tol}.
// N1: the green band (pace slows the gauge inside it instead, createBakeTimer).
export function bakeWindow(target, { greenWindow = 1 } = {}) {
  if (target.kind === 'sector') {
    return { lo: GREEN_MIN, hi: GREEN_MAX, center: (GREEN_MIN + GREEN_MAX) / 2, tol: (GREEN_MAX - GREEN_MIN) / 2 };
  }
  const gw = greenWindow > 1 ? greenWindow : 1;
  if (target.kind === 'number') {
    const center = target.number;
    const lo = center - NUMBER_EARLY * gw;
    const hi = center + NUMBER_LATE * gw;
    return { lo, hi, center, tol: (hi - lo) / 2 };
  }
  const center = target.duration;
  const tol = CLOCK_TOL * gw;
  return { lo: center - tol, hi: center + tol, center, tol };
}

// 'pale' | 'dore' | 'brule' for an amount baked (edges count as golden, as bakeState).
export function judgeAmount(amount, win) {
  if (amount < win.lo) return 'pale';
  if (amount > win.hi) return 'brule';
  return 'dore';
}

// The cake's look for an amount baked: the window maps onto the green band, below it onto
// 0..GREEN_MIN, above it onto GREEN_MAX..1 over one more `center`.
export function amountGauge(amount, win) {
  let g;
  if (amount < win.lo) g = win.lo > 0 ? (amount / win.lo) * GREEN_MIN : 0;
  else if (amount <= win.hi) g = GREEN_MIN + ((amount - win.lo) / (win.hi - win.lo)) * (GREEN_MAX - GREEN_MIN);
  else g = GREEN_MAX + ((amount - win.hi) / win.center) * (1 - GREEN_MAX);
  return Math.min(1, Math.max(0, g));
}

// The cake's look at N2 / N3 for an amount baked (time x heat factor) with flames `heat` for a
// target asking `target.heat`: as amountGauge, but wrong flames never look golden (a gauge that
// would be in the green band goes just under it with too few flames, just over it with too many).
export function timedGauge(amount, win, heat, targetHeat) {
  const g = amountGauge(amount, win);
  if (heat === targetHeat || g < GREEN_MIN || g > GREEN_MAX) return g;
  return heat < targetHeat ? GREEN_MIN - 0.03 : GREEN_MAX + 0.03;
}

// N2 / N3 judgement (the rule above): 'pale' | 'dore' | 'brule', always the look of timedGauge.
export function judgeTimed(amount, win, heat, targetHeat) {
  return bakeState(timedGauge(amount, win, heat, targetHeat));
}

// N2 / N3 timer: elapsed() = the time on the dial (numbers / hours), amount() = elapsed x heat
// factor (what the cake got). Stops at `max` (or earlier with stopAt, the N3 alarm: alarmReached
// tells whether it stops there, or at the cap first). Both units x the pace anim factor. Frames
// are clamped like createBakeTimer (a sleeping tablet never burns the cake).
export function createTimeTimer(target, heat, { anim = 1, stopAt = null } = {}) {
  const k = anim > 0 ? anim : 1;
  const unit = (target.kind === 'number' ? NUMBER_UNIT_MS : HOUR_MS) * k;
  const max = target.kind === 'number' ? NUMBER_MAX : target.duration + CLOCK_EXTRA;
  const alarmReached = stopAt !== null && stopAt > 0 && stopAt <= max;
  const end = alarmReached ? stopAt : max;
  const factor = heatFactor(heat, target.heat);
  let t = 0;
  return {
    tick(dtMs) {
      if (!(dtMs > 0) || t >= end) return;
      t = Math.min(end, t + Math.min(dtMs, MAX_DT) / unit);
    },
    elapsed() { return t; },
    amount() { return t * factor; },
    done() { return t >= end; },
    end,
    alarmReached,
  };
}

// ---- N3 clock -----------------------------------------------------------------------------------
// Hours on a 12-hour face: 0 < h <= 12 (12 at the top).
export function clockHours(h) {
  const r = ((h % 12) + 12) % 12;
  return r === 0 ? 12 : r;
}

// Clockwise angle from 12 o'clock (radians) -> hours snapped to whole (or half) hours.
export function angleToAlarm(angle, halfHours = false) {
  const step = halfHours ? 0.5 : 1;
  const h = (angle / (2 * Math.PI)) * 12;
  return clockHours(Math.round(h / step) * step);
}

// How long the oven runs from the start until the alarm: 0 < delay <= 12 h (an alarm on the
// start time itself rings after a full turn, i.e. too late; the scene does not start on it).
export function alarmDelay(start, alarm) {
  const d = (((alarm - start) % 12) + 12) % 12;
  return d === 0 ? 12 : d;
}

// The alarm she should set.
export function rightAlarm(target) {
  return clockHours(target.start + target.duration);
}
