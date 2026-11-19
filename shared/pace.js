export const PACES = ['calme', 'normal', 'rapide'];

export const PACE_FACTORS = {
  calme: { transition: 2.5, anim: 1.5, greenWindow: 1.5, particles: 0.5 },
  normal: { transition: 1, anim: 1, greenWindow: 1, particles: 1 },
  rapide: { transition: 0.6, anim: 1, greenWindow: 1, particles: 1 },
};

export function recommendedPace(age) {
  return age <= 6 ? 'calme' : 'normal';
}
