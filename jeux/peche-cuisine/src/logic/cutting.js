// Cut marks along a fish body (0..1) and snapping of a finger cut to a mark.

/** The weight - 1 marks that split a fish into `weight` equal portions. */
export function cutMarks(weight) {
  const marks = [];
  for (let i = 1; i < weight; i++) marks.push(i / weight);
  return marks;
}

/** Index of the nearest not-yet-cut mark within half a portion of x, else -1. */
export function snapCut(x, marks, done) {
  const reach = 0.5 / (marks.length + 1);
  let best = -1;
  let bestDist = Infinity;
  marks.forEach((m, i) => {
    if (done.includes(i)) return;
    const d = Math.abs(x - m);
    if (d <= reach && d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}
