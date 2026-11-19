import { ageFrom, ageLabel } from './profile.js';
import { recommendedPace } from './pace.js';
import { THEMES, isTheme } from './themes.js';
import { recommendedLevel, themeLevel, setThemeLevel, setOverride, phaseKey } from './difficulty.js';
import { phaseProposal } from './history.js';

// Phases that can be adjusted: `levels: 1` means not yet educational (no proposals).
function adjustablePhases(games) {
  const out = [];
  for (const g of games ?? []) for (const p of g.phases ?? []) if (p.levels !== 1) out.push({ game: g, phase: p });
  return out;
}

// Themes that change something today: used by at least one phase that has levels (levels > 1).
function usedThemes(games) {
  const used = new Set();
  for (const g of games ?? []) for (const p of g.phases ?? []) if ((p.levels ?? 3) > 1) used.add(p.theme);
  return used;
}

// « ratée 3 fois sur les 4 dernières parties »: what the parent can check against the rule
// (history.js phaseProposal: >= 3 failures among the last 4).
function downReason(c, gameId, phaseId) {
  const last = (c.history?.[phaseKey(gameId, phaseId)] ?? []).slice(-4);
  const fails = last.filter(ok => !ok).length;
  return `elle a été ratée ${fails} fois sur les ${last.length} dernières parties`;
}

// `games` (optional): [{id, name, phases: [{id, name, theme, levels}]}] from the registry; without
// it, no `phase` cards and no `niveau` cards (a theme level is only proposed for a theme that a
// phase with levels uses: the other themes change nothing yet).
export function recommendations(c, now, games) {
  const out = [];
  if (!c.profile) {
    out.push({
      id: 'profil',
      text: 'Renseignez le profil de votre enfant (prénom, mois et année de naissance) pour recevoir des conseils adaptés.',
      signature: 'none',
    });
  } else {
    const age = ageFrom(c.profile, now);
    const pace = recommendedPace(age);
    if (c.pace !== pace) {
      const desc = pace === 'calme'
        ? 'transitions plus lentes, moins d\'effets'
        : 'rythme habituel, effets complets';
      out.push({
        id: 'rythme',
        text: `Pour ${ageLabel(age)}, nous conseillons le rythme ${pace} : ${desc}.`,
        signature: String(age),
      });
    }
    const wanted = recommendedLevel(age);
    const used = usedThemes(games);
    for (const t of THEMES) {
      if (!used.has(t.id) || themeLevel(c, t.id) === wanted) continue;
      out.push({
        id: `niveau:${t.id}`,
        text: `Pour ${ageLabel(age)}, nous conseillons le niveau ${wanted} en ${t.name.toLowerCase()} : ${t.levels[wanted - 1]}.`,
        signature: String(age),
      });
    }
  }
  for (const { game, phase } of adjustablePhases(games)) {
    const p = phaseProposal(c, game.id, phase);
    if (!p) continue;
    const text = p.direction === 'down'
      ? `Baisser la phase « ${phase.name} » du jeu « ${game.name} » au niveau ${p.to} : ${downReason(c, game.id, phase.id)}.`
      : `Monter la phase « ${phase.name} » du jeu « ${game.name} » au niveau ${p.to} : elle a été réussie 5 fois de suite.`;
    out.push({ id: `phase:${phaseKey(game.id, phase.id)}`, text, signature: `${p.direction}${p.to}` });
  }
  if (!c.evening.enabled) {
    out.push({
      id: 'soir',
      text: 'Activez le mode soir pour des couleurs plus douces et un rythme calme en fin de journée.',
      signature: 'off',
    });
  }
  // phase proposals are silenced by their cleared history, not by a signature: a new series brings them back
  return out.filter(r => r.id.startsWith('phase:') || c.ignored[r.id] !== r.signature);
}

export function applyRecommendation(c, id, now, games) {
  if (id === 'rythme' && c.profile) {
    return { ...c, pace: recommendedPace(ageFrom(c.profile, now)) };
  }
  if (id.startsWith('niveau:') && c.profile) {
    const themeId = id.slice('niveau:'.length);
    return isTheme(themeId) ? setThemeLevel(c, themeId, recommendedLevel(ageFrom(c.profile, now)), games) : c;
  }
  if (id.startsWith('phase:')) {
    const found = adjustablePhases(games).find(({ game, phase }) => id === `phase:${phaseKey(game.id, phase.id)}`);
    const p = found && phaseProposal(c, found.game.id, found.phase);
    return p ? setOverride(c, found.game.id, found.phase.id, p.to) : c;
  }
  if (id === 'soir') {
    // keeps the hours the parent may already have chosen
    return { ...c, evening: { ...c.evening, enabled: true } };
  }
  return c;
}

// Ignoring a phase proposal clears that phase's history instead: it only comes back after a new
// series (nothing is written in `ignored`, which phase cards never read).
export function ignoreRecommendation(c, rec) {
  if (rec.id.startsWith('phase:')) {
    const history = { ...c.history };
    delete history[rec.id.slice('phase:'.length)];
    return { ...c, history };
  }
  return { ...c, ignored: { ...c.ignored, [rec.id]: rec.signature } };
}
