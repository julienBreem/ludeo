// Shared settings as the stand sees them: pace factors and evening mode.
// Pace is read when a scene starts (commit() in goTo/restart); a pace change in the middle of a
// scene applies from the next one. Evening's look applies at once (CSS filter on the canvas).
import { getEffective, onEffectiveChange } from '../../../../shared/runtime.js';

export const EVENING_FILTER = 'brightness(0.8) saturate(0.7) sepia(0.15)';
export const EVENING_FADE_MS = 1500;

let applied = getEffective(); // what the running scene uses
let latest = applied; // newest known settings

// The factors of the running scene: { transition, anim, greenWindow, particles }.
export function factors() {
  return applied.factors;
}

// ms x anim factor (main tweens and timed delays).
export function dur(ms) {
  return Math.round(ms * applied.factors.anim);
}

// Scene fade: 250 ms x transition factor.
export function fade() {
  return Math.round(250 * applied.factors.transition);
}

// Evening mode (confetti and sparkles are off while it is on).
export function isEvening() {
  return latest.evening;
}

// A new scene starts: it uses the newest pace.
export function commit() {
  applied = latest;
}

function setFilter(canvas, evening) {
  canvas.style.filter = evening ? EVENING_FILTER : 'none';
}

// Called once with the game's canvas: filter now, then follow the settings every 60 s.
export function installSettings(canvas) {
  latest = getEffective();
  applied = latest;
  canvas.style.transition = `filter ${EVENING_FADE_MS}ms ease`;
  setFilter(canvas, latest.evening);
  onEffectiveChange((e) => {
    latest = e;
    setFilter(canvas, e.evening);
  });
}
