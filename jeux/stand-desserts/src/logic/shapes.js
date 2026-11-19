// Geometric properties of every shape, used by the Moule exercises (clues).
export const SHAPE_PROPS = {
  rond: { corners: 0, sides: 0 },
  ovale: { corners: 0, sides: 0 },
  triangle: { corners: 3, sides: 3 },
  carre: { corners: 4, sides: 4, equalSides: true },
  rectangle: { corners: 4, sides: 4, equalSides: false },
  losange: { corners: 4, sides: 4, equalSides: true },
  hexagone: { corners: 6, sides: 6 },
  coeur: { fun: 'pointe' },
  etoile: { fun: 'branches', n: 5 },
  licorne: { fun: 'corne' },
};

// Is the clue true of this shape? Fun shapes (no geometric props) only match 'fun' clues.
export function clueHolds(clue, shape) {
  const p = SHAPE_PROPS[shape];
  if (!p || !clue) return false;
  switch (clue.kind) {
    case 'corners': return p.corners === clue.n;
    case 'sides': return p.sides === clue.n;
    case 'equalSides': return p.equalSides === true && p.sides === clue.n;
    case 'noCorner': return p.corners === 0;
    case 'fun': return p.fun === clue.fun;
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
