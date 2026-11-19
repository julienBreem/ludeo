// Geometric properties of every shape, used by the Moule exercises (clues).
// Fun shapes (no corners / sides to count) have one fun clue each, chosen so that no other shape
// has that feature at all: the heart's 2 bumps on top (« 2 bosses »: every polygon and the star
// have points, so the heart's tip would not tell it), the star's 5 branches, the unicorn's horn.
// FEATURES lists what a child can see on each outline (the fun clues are checked against it):
// bosses = rounded bumps (the unicorn's mane is bumpy too), branches = star arms, corne = horn.
export const SHAPE_PROPS = {
  rond: { corners: 0, sides: 0 },
  ovale: { corners: 0, sides: 0 },
  triangle: { corners: 3, sides: 3 },
  carre: { corners: 4, sides: 4, equalSides: true },
  rectangle: { corners: 4, sides: 4, equalSides: false },
  losange: { corners: 4, sides: 4, equalSides: true },
  hexagone: { corners: 6, sides: 6 },
  coeur: { fun: 'bosses', n: 2 },
  etoile: { fun: 'branches', n: 5 },
  licorne: { fun: 'corne' },
};

export const FEATURES = {
  coeur: { bosses: 2 },
  etoile: { branches: 5 },
  licorne: { corne: 1, bosses: 5 },
};

// Is the clue true of this shape? A fun clue holds for every shape that has that feature at all
// (whatever the number), so that a choice that merely shares it is never offered beside it.
export function clueHolds(clue, shape) {
  const p = SHAPE_PROPS[shape];
  if (!p || !clue) return false;
  switch (clue.kind) {
    case 'corners': return p.corners === clue.n;
    case 'sides': return p.sides === clue.n;
    case 'equalSides': return p.equalSides === true && p.sides === clue.n;
    case 'noCorner': return p.corners === 0;
    case 'fun': return (FEATURES[shape]?.[clue.fun] ?? 0) > 0;
    default: return false;
  }
}

// Every clue that is true of the shape.
export function cluesFor(shape) {
  const p = SHAPE_PROPS[shape];
  if (!p) return [];
  if (p.fun) return [p.n ? { kind: 'fun', fun: p.fun, n: p.n } : { kind: 'fun', fun: p.fun }];
  if (p.corners === 0) return [{ kind: 'noCorner' }];
  const out = [{ kind: 'corners', n: p.corners }, { kind: 'sides', n: p.sides }];
  if (p.equalSides) out.push({ kind: 'equalSides', n: p.sides });
  return out;
}

// The clue's pictogram (texture key, ui/moldArt.js) and its word (under the picture, for the
// parent: « 3 côtés », « pas de coin », « 2 bosses »).
const PICT = { corners: 'pict-coin', sides: 'pict-cote', equalSides: 'pict-cote', noCorner: 'pict-rond' };
export const FUN_PICT = { bosses: 'pict-bosses', branches: 'pict-branche', corne: 'pict-corne' };
export function cluePict(clue) {
  if (!clue) return null;
  return (clue.kind === 'fun' ? FUN_PICT[clue.fun] : PICT[clue.kind]) ?? null;
}

export function clueWord(clue) {
  if (!clue) return '';
  switch (clue.kind) {
    case 'corners': return `${clue.n} coins`;
    case 'sides': return `${clue.n} côtés`;
    case 'equalSides': return `${clue.n} côtés pareils`;
    case 'noCorner': return 'pas de coin';
    case 'fun':
      if (clue.fun === 'corne') return 'une corne';
      if (clue.fun === 'bosses') return `${clue.n} bosses`;
      if (clue.fun === 'branches') return `${clue.n} pointes`;
      return '';
    default: return '';
  }
}
