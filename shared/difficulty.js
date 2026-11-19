// Levels 1-3: one per theme, with optional per-phase overrides. All functions are pure.
// A phase is {id, theme}; a game is {id, name, phases: [...]} (passed in: shared/ never imports the registry).
import { isTheme } from './themes.js';

export const phaseKey = (gameId, phaseId) => `${gameId}/${phaseId}`;
export const isLevel = n => Number.isInteger(n) && n >= 1 && n <= 3;

// Age <= 6 -> 1, 7 -> 2, >= 8 -> 3 (the same for every theme).
export function recommendedLevel(age) {
  return age >= 8 ? 3 : age === 7 ? 2 : 1;
}

export function themeLevel(c, themeId) {
  const n = c.levels?.[themeId];
  return isLevel(n) ? n : 1;
}

export function phaseLevel(c, gameId, phase) {
  const n = c.overrides?.[phaseKey(gameId, phase.id)];
  return isLevel(n) ? n : themeLevel(c, phase.theme);
}

function withoutHistory(c, keys) {
  if (!keys.some(k => k in c.history)) return c;
  const history = { ...c.history };
  for (const k of keys) delete history[k];
  return { ...c, history };
}

// Changing a theme level resets the history of the phases that follow it (those without their own override).
// `games` (optional) says which phases those are; without it no history is cleared.
export function setThemeLevel(c, themeId, n, games = []) {
  if (!isTheme(themeId) || !isLevel(n)) return c;
  const keys = [];
  if (themeLevel(c, themeId) !== n) {
    for (const g of games) {
      for (const p of g.phases) {
        const k = phaseKey(g.id, p.id);
        if (p.theme === themeId && !isLevel(c.overrides[k])) keys.push(k);
      }
    }
  }
  return withoutHistory({ ...c, levels: { ...c.levels, [themeId]: n } }, keys);
}

// n = 1..3 sets the phase's own level, null goes back to the theme's. Clears the phase's history.
export function setOverride(c, gameId, phaseId, n) {
  const k = phaseKey(gameId, phaseId);
  const overrides = { ...c.overrides };
  if (isLevel(n)) overrides[k] = n;
  else if (n === null) delete overrides[k];
  else return c;
  return withoutHistory({ ...c, overrides }, [k]);
}
