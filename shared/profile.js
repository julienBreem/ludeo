// Full years of age from a birth month (1-12) and year.
export function ageFrom({ month, year }, now) {
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month) age -= 1;
  return Math.max(0, age);
}

// True when that birth month is after now's month (not born yet).
export function isFutureBirth({ month, year }, now) {
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
}

// "0 an", "1 an", "2 ans"… (French: plural from 2).
export function ageLabel(age) {
  return `${age} ${age >= 2 ? 'ans' : 'an'}`;
}
