import { ageFrom, ageLabel } from './profile.js';
import { recommendedPace } from './pace.js';

export function recommendations(c, now) {
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
  }
  if (!c.evening.enabled) {
    out.push({
      id: 'soir',
      text: 'Activez le mode soir pour des couleurs plus douces et un rythme calme en fin de journée.',
      signature: 'off',
    });
  }
  return out.filter(r => c.ignored[r.id] !== r.signature);
}

export function applyRecommendation(c, id, now) {
  if (id === 'rythme' && c.profile) {
    return { ...c, pace: recommendedPace(ageFrom(c.profile, now)) };
  }
  if (id === 'soir') {
    // keeps the hours the parent may already have chosen
    return { ...c, evening: { ...c.evening, enabled: true } };
  }
  return c;
}

export function ignoreRecommendation(c, rec) {
  return { ...c, ignored: { ...c.ignored, [rec.id]: rec.signature } };
}
