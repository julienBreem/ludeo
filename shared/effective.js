import { PACE_FACTORS } from './pace.js';
import { isEvening } from './evening.js';

export function effectiveSettings(c, now) {
  const evening = isEvening(now, c.evening);
  const pace = evening ? 'calme' : c.pace;
  return { pace, evening, factors: PACE_FACTORS[pace] };
}
