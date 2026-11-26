import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TUNING, createAngling, pickFish, approach, strike, step, tension01,
} from '../../jeux/peche-cuisine/src/logic/angling.js';
import { makeRng } from '../../jeux/peche-cuisine/src/logic/rng.js';

const SIZES = ['petit', 'moyen', 'grand'];

// Steps `a` for `ms` in frames of `frame` ms; holdingFn(a, t) decides the finger.
// Returns the final angling, all events with their time, and the elapsed time.
function run(a, ms, holdingFn, rng, frame = 16) {
  const events = [];
  let t = 0;
  while (t < ms && a.phase !== 'over') {
    const r = step(a, frame, holdingFn(a, t), rng);
    a = r.a;
    t += frame;
    for (const e of r.events) events.push({ e, t });
  }
  return { a, events, t };
}

// A fight already hooked: approach with no nibble path forced through, then strike at the bite.
function hooked(size, rng, pace = 1) {
  let a = approach(createAngling(pace), 'f1', size, 0, rng);
  let guard = 0;
  while (a.phase !== 'bite' && guard++ < 1000) a = step(a, 16, false, rng).a;
  assert.equal(a.phase, 'bite');
  return strike(a);
}

const alwaysHold = () => true;
const releaseOnThrash = (a) => !a.thrashing;
// Lets go 400 ms after each thrash starts.
function hesitant() {
  let since = null;
  return (a, t) => {
    if (!a.thrashing) { since = null; return true; }
    if (since === null) since = t;
    return t - since < 400;
  };
}

test('pickFish: nearest within the radius, null when all are far', () => {
  const fishes = [{ id: 'a', x: 300, y: 300 }, { id: 'b', x: 120, y: 100 }, { id: 'c', x: 160, y: 100 }];
  assert.equal(pickFish({ x: 100, y: 100 }, fishes), 'b');
  assert.equal(pickFish({ x: 100, y: 100 }, fishes, 15), null);
  assert.equal(pickFish({ x: 1000, y: 700 }, fishes), null);
  assert.equal(pickFish({ x: 100, y: 100 }, []), null);
});

test('approach then 0..2 nibbles then a bite; approach time = dist / speed × pace', () => {
  const rng = makeRng(1);
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const a = approach(createAngling(1.5), 'f', 'moyen', 160, rng);
    assert.equal(a.phase, 'approach');
    assert.equal(a.approachMs, 160 / TUNING.approachSpeed * 1.5);
    const { a: end, events } = run(a, 20000, () => false, rng);
    const nibbles = events.filter((x) => x.e === 'nibble').length;
    assert.ok(nibbles >= TUNING.nibbles[0] && nibbles <= TUNING.nibbles[1]);
    seen.add(nibbles);
    const bite = events.find((x) => x.e === 'bite');
    assert.ok(bite, 'a bite comes');
    assert.ok(bite.t >= a.approachMs);
    assert.equal(end.result, 'missed');
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});

test('strike during a nibble or the approach spooks the fish', () => {
  const rng = makeRng(2);
  const a = approach(createAngling(), 'f', 'petit', 200, rng);
  const s = strike(a);
  assert.equal(s.phase, 'over');
  assert.equal(s.result, 'spooked');
  let b = approach(createAngling(), 'f', 'petit', 0, makeRng(9));
  b = { ...b, nibblesLeft: 1 };
  let guard = 0;
  while (b.phase !== 'nibble' && guard++ < 500) b = step(b, 16, false, rng).a;
  assert.equal(b.phase, 'nibble');
  assert.equal(strike(b).result, 'spooked');
});

test('the bite lasts biteMs × pace, then the fish is missed', () => {
  const rng = makeRng(3);
  let a = approach(createAngling(1.5), 'f', 'petit', 0, rng);
  let guard = 0;
  while (a.phase !== 'bite' && guard++ < 1000) a = step(a, 10, false, rng).a;
  const { a: end, events, t } = run(a, 10000, () => false, rng, 10);
  assert.equal(end.result, 'missed');
  assert.deepEqual(events.map((x) => x.e), ['missed']);
  assert.ok(Math.abs(t - TUNING.biteMs * 1.5) <= 10);
});

test('strike in the bite window starts the fight', () => {
  const f = hooked('moyen', makeRng(4));
  assert.equal(f.phase, 'fight');
  assert.equal(f.distance, 1);
  assert.equal(f.tension, 0);
});

test('waiting summons a fish after noFishFallbackMs, once', () => {
  const rng = makeRng(5);
  const { events } = run(createAngling(), 3 * TUNING.noFishFallbackMs, () => false, rng, 10);
  const summons = events.filter((x) => x.e === 'summon');
  assert.equal(summons.length, 1);
  assert.ok(Math.abs(summons[0].t - TUNING.noFishFallbackMs) <= 10);
});

test('always holding snaps the line, every size (50 seeds each): the same act always has the same result', () => {
  for (const size of SIZES) for (let s = 1; s <= 50; s++) {
    const rng = makeRng(s);
    const { a } = run(hooked(size, rng), 60000, alwaysHold, rng);
    assert.equal(a.result, 'broken', `${size} seed ${s}`);
  }
});

test('every size thrashes at least once before it can be landed', () => {
  for (const size of SIZES) for (let s = 1; s <= 50; s++) {
    const rng = makeRng(200 + s);
    const { a, events } = run(hooked(size, rng), 60000, releaseOnThrash, rng);
    assert.equal(a.result, 'landed');
    assert.ok(events.some((x) => x.e === 'thrashStart'), `${size} seed ${s} never thrashed`);
  }
});

test('releasing during every thrash lands every size (100 % of 50 seeds, each within 30 s)', () => {
  for (const size of SIZES) for (let s = 1; s <= 50; s++) {
    const rng = makeRng(s);
    const { a, t } = run(hooked(size, rng), 30000, releaseOnThrash, rng);
    assert.equal(a.result, 'landed', `${size} seed ${s}`);
    assert.ok(t <= 30000);
  }
});

test('a hesitant player (releases 400 ms after a thrash starts) still lands every size', () => {
  for (const size of SIZES) for (let s = 1; s <= 50; s++) {
    const rng = makeRng(100 + s);
    const { a } = run(hooked(size, rng), 60000, hesitant(), rng);
    assert.equal(a.result, 'landed', `${size} seed ${s}`);
  }
});

test('holding while the fish does not thrash never raises the tension', () => {
  const rng = makeRng(6);
  let a = hooked('grand', rng);
  for (let i = 0; i < 3000 && a.phase === 'fight'; i++) {
    const before = a.tension;
    const wasThrashing = a.thrashing;
    a = step(a, 16, !a.thrashing, rng).a;
    if (!wasThrashing && a.phase === 'fight') assert.ok(a.tension <= before);
  }
});

test('no hold, no break and no progress', () => {
  const rng = makeRng(7);
  const { a } = run(hooked('grand', rng), 20000, () => false, rng);
  assert.equal(a.phase, 'fight');
  assert.equal(a.distance, 1);
  assert.equal(a.tension, 0);
});

test('a grand fish takes longer to land than a petit (mean over 50 seeds)', () => {
  const mean = (size) => {
    let sum = 0;
    for (let s = 1; s <= 50; s++) {
      const rng = makeRng(s);
      sum += run(hooked(size, rng), 60000, releaseOnThrash, rng).t;
    }
    return sum / 50;
  };
  assert.ok(mean('grand') > mean('petit') * 1.5);
});

test('calm pace 1.5: the line snaps 1.5 × later', () => {
  // Hold only during thrashes, so the time to snap is the tension build-up.
  const snapAfter = (pace) => {
    const rng = makeRng(8);
    let a = hooked('grand', rng, pace);
    let guard = 0;
    while (!a.thrashing && guard++ < 10000) a = step(a, 1, false, rng).a;
    let t = 0;
    while (a.phase === 'fight') { a = step(a, 1, true, rng).a; t++; }
    assert.equal(a.result, 'broken');
    return t;
  };
  assert.ok(Math.abs(snapAfter(1.5) - 1.5 * snapAfter(1)) <= 2);
});

test('tension01 runs 0..1 against the break threshold', () => {
  const a = { ...createAngling(2), tension: TUNING.breakMs };
  assert.equal(tension01(a), 0.5);
  assert.equal(tension01(createAngling()), 0);
});

test('a 500 ms frame is split: same result as 50 ms frames for a hold-through-thrash player', () => {
  for (let s = 1; s <= 20; s++) {
    const small = run(hooked('grand', makeRng(s)), 60000, alwaysHold, makeRng(1000 + s), 50);
    const big = run(hooked('grand', makeRng(s)), 60000, alwaysHold, makeRng(1000 + s), 500);
    assert.equal(big.a.result, small.a.result, `seed ${s}`);
    assert.equal(big.a.distance, small.a.distance, `seed ${s}`);
    // A long frame never lets the line hold longer than a sub-step past the threshold.
    assert.ok(big.a.tension <= TUNING.breakMs + 50);
  }
});

test('while the fish thrashes, holding does not reel it in', () => {
  const rng = makeRng(12);
  let a = hooked('grand', rng);
  let guard = 0;
  while (!a.thrashing && guard++ < 10000) a = step(a, 10, false, rng).a;
  const before = a.distance;
  a = step(a, 300, true, rng).a;
  assert.ok(a.thrashing || a.phase === 'over');
  assert.equal(a.distance, before);
});
