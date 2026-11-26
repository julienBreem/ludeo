// What the player owns decides the game setup. Lot 1: starter values only.
export const ALL_COLORS = ['bleu', 'rouge', 'jaune', 'vert', 'violet', 'orange'];

/** Starter setup; lot 3 will derive it from state.owned. */
// eslint-disable-next-line no-unused-vars
export function gameSetup(state) {
  return { colors: ['bleu', 'rouge'], capacity: 8, pondSize: 4, rod: 'bambou', garnishes: ['citron', 'salade'] };
}
