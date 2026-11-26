// Fishing by casting: the timeline of one cast, from the bobber landing to the fish landed, the
// line snapped or the fish gone. Pure and Phaser-free: the scene calls step() every frame with
// the finger state and draws what this returns. Every duration is at pace 1 and multiplied by
// the pace (the parent's calm pace slows everything down, the break included).
//
// Phases: waiting (no fish near the bobber) → approach → nibble / gap (fake touches) → bite →
// fight → over (result: landed | broken | missed | spooked).

export const TUNING = {
  noticeRadius: 230, // canvas px: fish farther than this ignore the bobber
  approachSpeed: 0.08, // canvas px per ms
  noFishFallbackMs: 4000, // with no fish near, one is summoned after this
  nibbles: [0, 2], // fake touches before the bite, inclusive
  nibbleMs: 450,
  nibbleGapMs: [500, 1100],
  biteMs: 1500, // the strike window
  reelMs: { petit: 2200, moyen: 3500, grand: 5000 }, // holding time to land, thrashes excluded
  // Every thrash lasts longer than breakMs, so holding through one always snaps the line, for
  // every size: the same act always has the same result. Bigger fish thrash more often and longer.
  thrash: {
    petit: { gap: [2500, 4000], lasts: [1100, 1300] },
    moyen: { gap: [1800, 3000], lasts: [1150, 1450] },
    grand: { gap: [1200, 2200], lasts: [1200, 1700] },
  },
  firstThrash: 0.5, // × the size's shortest gap: every fish thrashes before it can be landed
  breakMs: 1000, // tension (holding during a thrash) that snaps the line
  relaxRate: 2, // tension falls this many times faster than it rises
};

const MAX_SUBSTEP = 50; // ms: a long frame is split so no thrash window is skipped

const between = ([lo, hi], rng) => lo + rng() * (hi - lo);

export function createAngling(pace = 1) {
  return {
    phase: 'waiting', pace, t: 0, summoned: false, approachMs: 0,
    fishId: null, size: null, nibblesLeft: 0,
    distance: 1, tension: 0, thrashing: false, nextThrash: 0, result: null,
  };
}

/** The nearest fish within the radius of the bobber, or null. */
export function pickFish(bobber, fishes, radius = TUNING.noticeRadius) {
  let best = null;
  let bestD = Infinity;
  for (const f of fishes) {
    const d = Math.hypot(f.x - bobber.x, f.y - bobber.y);
    if (d <= radius && d < bestD) { best = f.id; bestD = d; }
  }
  return best;
}

/** A fish heads for the bobber, distPx away. */
export function approach(a, fishId, size, distPx, rng) {
  const approachMs = (distPx / TUNING.approachSpeed) * a.pace;
  const [lo, hi] = TUNING.nibbles;
  const nibblesLeft = lo + Math.floor(rng() * (hi - lo + 1));
  return { ...a, phase: 'approach', fishId, size, approachMs, t: approachMs, nibblesLeft };
}

/** The child strikes: hooks a biting fish, scares one that is only nibbling or coming. */
export function strike(a) {
  if (a.phase === 'bite') {
    const first = TUNING.thrash[a.size].gap[0] * TUNING.firstThrash * a.pace;
    return { ...a, phase: 'fight', distance: 1, tension: 0, thrashing: false, nextThrash: first };
  }
  if (a.phase === 'approach' || a.phase === 'nibble' || a.phase === 'gap') {
    return { ...a, phase: 'over', result: 'spooked' };
  }
  return a;
}

/** 0..1: how close the line is to snapping. */
export function tension01(a) {
  return a.tension / (TUNING.breakMs * a.pace);
}

function toNibbleOrBite(a, events) {
  if (a.nibblesLeft > 0) {
    events.push('nibble');
    return { ...a, phase: 'nibble', t: TUNING.nibbleMs * a.pace, nibblesLeft: a.nibblesLeft - 1 };
  }
  events.push('bite');
  return { ...a, phase: 'bite', t: TUNING.biteMs * a.pace };
}

function fight(a, dt, holding, rng, events) {
  const tune = TUNING.thrash[a.size];
  let { distance, tension, thrashing, nextThrash } = a;
  if (holding && thrashing) tension += dt;
  else tension = Math.max(0, tension - dt * TUNING.relaxRate);
  if (holding && !thrashing) distance -= dt / (TUNING.reelMs[a.size] * a.pace);
  nextThrash -= dt;
  if (nextThrash <= 0) {
    thrashing = !thrashing;
    nextThrash = between(thrashing ? tune.lasts : tune.gap, rng) * a.pace;
    events.push(thrashing ? 'thrashStart' : 'thrashEnd');
  }
  if (tension >= TUNING.breakMs * a.pace) {
    events.push('broken');
    return { ...a, tension, distance, thrashing, nextThrash, phase: 'over', result: 'broken' };
  }
  if (distance <= 0) {
    events.push('landed');
    return { ...a, tension, distance: 0, thrashing, nextThrash, phase: 'over', result: 'landed' };
  }
  return { ...a, distance, tension, thrashing, nextThrash };
}

function substep(a, dt, holding, rng, events) {
  switch (a.phase) {
    case 'waiting': {
      const t = a.t + dt;
      if (!a.summoned && t >= TUNING.noFishFallbackMs * a.pace) {
        events.push('summon');
        return { ...a, t, summoned: true };
      }
      return { ...a, t };
    }
    case 'approach':
    case 'gap': {
      const t = a.t - dt;
      return t > 0 ? { ...a, t } : toNibbleOrBite(a, events);
    }
    case 'nibble': {
      const t = a.t - dt;
      return t > 0 ? { ...a, t } : { ...a, phase: 'gap', t: between(TUNING.nibbleGapMs, rng) * a.pace };
    }
    case 'bite': {
      const t = a.t - dt;
      if (t > 0) return { ...a, t };
      events.push('missed');
      return { ...a, phase: 'over', result: 'missed' };
    }
    case 'fight':
      return fight(a, dt, holding, rng, events);
    default:
      return a;
  }
}

/** Advances the cast by dtMs with the finger down or up. Returns { a, events }. */
export function step(a, dtMs, holding, rng) {
  const events = [];
  const n = Math.max(1, Math.ceil(dtMs / MAX_SUBSTEP));
  const dt = dtMs / n;
  for (let i = 0; i < n && a.phase !== 'over'; i++) a = substep(a, dt, holding, rng, events);
  return { a, events };
}
