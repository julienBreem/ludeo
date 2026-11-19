// Common themes of the collection (parent-facing French). Levels 1-3.
export const THEMES = [
  { id: 'lecture', name: 'Lecture', levels: ['mots associés à l\'image', 'mots seuls, chiffres', 'phrases, nombres en lettres'] },
  { id: 'nombres', name: 'Nombres', levels: ['dénombrer jusqu\'à 5 (constellations)', 'chiffres et additions jusqu\'à 10', 'compléments et doubles jusqu\'à 20'] },
  { id: 'geometrie', name: 'Géométrie', levels: ['reconnaître une forme', 'propriétés (côtés, coins)', 'assembler et orienter'] },
  { id: 'temps', name: 'Temps', levels: ['minuterie à secteur', 'lire un nombre sur un cadran', 'horloge, heures et demi-heures'] },
  { id: 'couleurs-fractions', name: 'Couleurs et fractions', levels: ['couleurs prêtes, moitiés', 'mélanges, moitiés et tiers', 'mélanges, parts inégales et quarts'] },
  { id: 'logique', name: 'Logique', levels: ['correspondance simple', 'suites (AB, AAB, ABC)', 'comparaisons (=, +1, −1)'] },
  { id: 'monnaie', name: 'Monnaie', levels: ['compter des pièces de 1', 'additionner 1, 2 et 5', 'rendre la monnaie'] },
];

export function isTheme(id) {
  return typeof id === 'string' && THEMES.some(t => t.id === id);
}
