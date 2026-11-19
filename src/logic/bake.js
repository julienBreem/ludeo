export const GREEN_MIN = 0.45;
export const GREEN_MAX = 0.70;

export function bakeState(gauge) {
  if (gauge < GREEN_MIN) return 'pale';
  if (gauge > GREEN_MAX) return 'brule';
  return 'dore';
}
