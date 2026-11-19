// 1-D placement of label tags in a row (Commande N1): each tag as close as possible to the x of
// the element it names, never overlapping its neighbours, inside [min, max] when they fit.

/**
 * placeRow(items: Array<{want: number, w: number}>, min, max, gap = 12) -> number[]
 * Centres (same order as items). The left-to-right order of `want` is kept, so leader lines from
 * the tags to their elements never cross. When the tags are wider than max - min together, the
 * row is centred on the middle of [min, max] and overflows on both sides.
 */
export function placeRow(items, min, max, gap = 12) {
  const order = items.map((it, i) => i).sort((a, b) => items[a].want - items[b].want || a - b);
  const total = order.reduce((s, i) => s + items[i].w, 0) + gap * Math.max(0, items.length - 1);
  const out = new Array(items.length);
  if (total >= max - min) {
    let x = (min + max) / 2 - total / 2;
    for (const i of order) {
      out[i] = x + items[i].w / 2;
      x += items[i].w + gap;
    }
    return out;
  }
  // left edges: wanted position, clamped into [min, max], then pushed right past the previous one
  const left = order.map(i => Math.min(max - items[i].w, Math.max(min, items[i].want - items[i].w / 2)));
  for (let k = 1; k < order.length; k++) {
    const prevEnd = left[k - 1] + items[order[k - 1]].w + gap;
    if (left[k] < prevEnd) left[k] = prevEnd;
  }
  // past the right end: push back to the left (it fits, so the first one stays >= min)
  let end = max;
  for (let k = order.length - 1; k >= 0; k--) {
    const w = items[order[k]].w;
    if (left[k] + w > end) left[k] = end - w;
    end = left[k] - gap;
  }
  order.forEach((i, k) => { out[i] = left[k] + items[i].w / 2; });
  return out;
}
