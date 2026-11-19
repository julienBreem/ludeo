// Full years of age from a birth month (1-12) and year.
export function ageFrom({ month, year }, now) {
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month) age -= 1;
  return Math.max(0, age);
}
