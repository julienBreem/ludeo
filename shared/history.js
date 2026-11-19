// Last results of each phase (the point at Service: true = won) and the adjustment it suggests.
import { phaseKey, phaseLevel } from './difficulty.js';

export const HISTORY_MAX = 5;

export function recordResult(c, gameId, phaseId, ok) {
  const k = phaseKey(gameId, phaseId);
  const list = [...(c.history[k] ?? []), ok === true].slice(-HISTORY_MAX);
  return { ...c, history: { ...c.history, [k]: list } };
}

// >= 3 failures among the last 4 -> one level down; 5 successes in a row -> one level up (within 1..3).
export function phaseProposal(c, gameId, phase) {
  const list = c.history?.[phaseKey(gameId, phase.id)] ?? [];
  const level = phaseLevel(c, gameId, phase);
  if (list.slice(-4).filter(ok => !ok).length >= 3 && level > 1) return { direction: 'down', to: level - 1 };
  if (list.length >= 5 && list.slice(-5).every(Boolean) && level < 3) return { direction: 'up', to: level + 1 };
  return null;
}
