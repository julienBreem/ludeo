import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeRate, createBakeTimer, MAX_DT, GREEN_MIN, GREEN_MAX } from '../jeux/stand-desserts/src/logic/bake.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('at target heat, 10 s fills the gauge', () => {
  const b = createBakeTimer(2, 2);
  for (let i = 0; i < 625; i++) b.tick(16);
  near(b.gauge(), 1);
});

test('green window at target is 2.5 s', () => {
  near((GREEN_MAX - GREEN_MIN) / bakeRate(2, 2), 2500, 1e-6);
});

test('hotter is faster, colder is slower', () => {
  assert.equal(bakeRate(3, 2), 2 / 10000);
  assert.equal(bakeRate(1, 3), 0.25 / 10000);
  assert.ok(Math.abs(bakeRate(4, 2) - 3 / 10000) < 1e-15);
  assert.equal(bakeRate(1, 2), 0.5 / 10000);
});

test('a huge frame gap is clamped (tablet slept)', () => {
  const b = createBakeTimer(2, 2);
  b.tick(60000);
  near(b.gauge(), 0.01);
  assert.equal(MAX_DT, 100);
});

test('negative or NaN dt is ignored', () => {
  const b = createBakeTimer(2, 2);
  b.tick(-50);
  b.tick(NaN);
  assert.equal(b.gauge(), 0);
});

test('gauge is clamped to 1', () => {
  const b = createBakeTimer(4, 2);
  for (let i = 0; i < 1000; i++) b.tick(100);
  assert.equal(b.gauge(), 1);
});

// Time (ms, 16 ms frames capped by MAX_DT) for the gauge to reach `level`.
function timeTo(timer, level) {
  let t = 0;
  while (timer.gauge() < level && t < 100000) { timer.tick(16); t += 16; }
  return t;
}

test('greenFactor 1.5 stretches the green window to 3750 ms; time to green is unchanged', () => {
  const plain = createBakeTimer(2, 2);
  const calm = createBakeTimer(2, 2, { greenFactor: 1.5 });
  const toGreenPlain = timeTo(plain, GREEN_MIN);
  const toGreenCalm = timeTo(calm, GREEN_MIN);
  assert.ok(Math.abs(toGreenPlain - toGreenCalm) <= 16);
  assert.ok(Math.abs(toGreenCalm - 4500) <= 16);
  const outPlain = timeTo(plain, GREEN_MAX + 1e-9);
  const outCalm = timeTo(calm, GREEN_MAX + 1e-9);
  assert.ok(Math.abs(toGreenPlain + 2500 - (toGreenPlain + outPlain)) <= 32);
  assert.ok(Math.abs(outCalm - 3750) <= 32, `calm window ${outCalm}`);
});

test('greenFactor is exact across a frame that straddles the band edge', () => {
  const a = createBakeTimer(2, 2, { greenFactor: 1.5 });
  const b = createBakeTimer(2, 2, { greenFactor: 1.5 });
  for (let i = 0; i < 100; i++) a.tick(50);
  for (let i = 0; i < 500; i++) b.tick(10);
  near(a.gauge(), b.gauge(), 1e-9);
});

test('default greenFactor is 1 and leaves the timer unchanged', () => {
  const a = createBakeTimer(2, 2);
  const b = createBakeTimer(2, 2, { greenFactor: 1 });
  for (let i = 0; i < 300; i++) { a.tick(16); b.tick(16); }
  assert.equal(a.gauge(), b.gauge());
});

// ---- levels (theme temps) ----------------------------------------------------------------------
import {
  bakeTarget, bakeWindow, judgeAmount, amountGauge, createTimeTimer, heatFactor, bakeState,
  LEVEL_NUMBERS, NUMBER_EARLY, NUMBER_LATE, NUMBER_UNIT_MS, timedGauge, judgeTimed, NUMBER_MAX, CLOCK_TOL, HOUR_MS, CLOCK_EXTRA,
  angleToAlarm, alarmDelay, rightAlarm, clockHours, HALF_HOURS,
} from '../jeux/stand-desserts/src/logic/bake.js';
import { DESSERTS } from '../jeux/stand-desserts/src/logic/catalog.js';

const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const PACES = [1, 1.5];

test('bakeTarget: the kind per level, the heat of the dessert at every level', () => {
  for (const d of Object.keys(DESSERTS)) {
    assert.deepEqual(bakeTarget(d, 1), { kind: 'sector', level: 1, heat: DESSERTS[d].heat });
    assert.deepEqual(bakeTarget(d, 2), { kind: 'number', level: 2, heat: DESSERTS[d].heat, number: LEVEL_NUMBERS[d] });
    const t = bakeTarget(d, 3, { rng: () => 0 });
    assert.equal(t.kind, 'clock');
    assert.equal(t.heat, DESSERTS[d].heat);
  }
  assert.deepEqual(LEVEL_NUMBERS, { cupcake: 2, gateau: 3, tarte: 4 });
});

test('N3: start on a whole hour 1..10, 1 h; ½ h only with halfHours', () => {
  assert.equal(HALF_HOURS, false);
  const rng = seeded(7);
  const starts = new Set();
  for (let i = 0; i < 500; i++) {
    const t = bakeTarget('gateau', 3, { rng });
    assert.ok(Number.isInteger(t.start) && t.start >= 1 && t.start <= 10, `start ${t.start}`);
    assert.equal(t.duration, 1);
    assert.ok(t.start + t.duration <= 12);
    starts.add(t.start);
  }
  assert.equal(starts.size, 10);
  const durs = new Set();
  for (let i = 0; i < 200; i++) durs.add(bakeTarget('tarte', 3, { rng, halfHours: true }).duration);
  assert.deepEqual([...durs].sort(), [0.5, 1]);
});

test('N2 window leans late, N3 is symmetric; both scale with greenWindow', () => {
  for (const gw of PACES) {
    for (const d of Object.keys(DESSERTS)) {
      const w = bakeWindow(bakeTarget(d, 2), { greenWindow: gw });
      near(w.center, LEVEL_NUMBERS[d]);
      near(w.center - w.lo, NUMBER_EARLY * gw);
      near(w.hi - w.center, NUMBER_LATE * gw);
      assert.ok(w.hi - w.center > w.center - w.lo, 'more time after the number than before');
    }
    for (const duration of [1, 0.5]) {
      const w = bakeWindow({ kind: 'clock', heat: 2, start: 3, duration }, { greenWindow: gw });
      near(w.center, duration);
      near(w.center - w.lo, CLOCK_TOL * gw);
      near(w.hi - w.center, CLOCK_TOL * gw);
      assert.ok(w.lo > 0, 'a ½ h duration still needs some baking');
    }
  }
  // a pace below 1 never narrows the window
  const w = bakeWindow(bakeTarget('gateau', 2), { greenWindow: 0.5 });
  near(w.hi - w.center, NUMBER_LATE);
});

test('N2: after the hand reaches the number she has about 1.5 s (2.25 x that at calme)', () => {
  for (const [anim, gw, least] of [[1, 1, 1450], [1.5, 1.5, 3300]]) {
    for (const n of Object.values(LEVEL_NUMBERS)) {
      const target = { kind: 'number', heat: 2, number: n };
      const w = bakeWindow(target, { greenWindow: gw });
      const t = createTimeTimer(target, 2, { anim });
      let ms = 0;
      while (t.elapsed() < n) { t.tick(16); ms += 16; }
      let after = 0;
      while (judgeTimed(t.amount(), w, 2, 2) === 'dore') { t.tick(16); after += 16; }
      assert.ok(after >= least, `n ${n} anim ${anim}: ${after} ms after the hand reached it`);
      assert.ok(ms >= n * NUMBER_UNIT_MS * anim - 32, 'the hand is slower at calme');
    }
  }
});

test('N2 tolerance: a neighbour number is always wrong, the target always right', () => {
  for (const gw of PACES) {
    for (const n of Object.values(LEVEL_NUMBERS)) {
      const w = bakeWindow({ kind: 'number', heat: 2, number: n }, { greenWindow: gw });
      assert.equal(judgeAmount(n, w), 'dore');
      assert.equal(judgeAmount(n - 1, w), 'pale');
      assert.equal(judgeAmount(n + 1, w), 'brule');
      assert.equal(judgeAmount(w.lo, w), 'dore');
      assert.equal(judgeAmount(w.hi, w), 'dore');
      assert.equal(judgeAmount(w.lo - 1e-6, w), 'pale');
      assert.equal(judgeAmount(w.hi + 1e-6, w), 'brule');
    }
  }
});

test('N3: an alarm set ½ h or 1 h off is wrong at every pace (pale early, burnt late)', () => {
  for (const gw of PACES) {
    for (const duration of [0.5, 1]) {
      const target = { kind: 'clock', heat: 2, start: 4, duration };
      const w = bakeWindow(target, { greenWindow: gw });
      for (const off of [-1, -0.5, 0.5, 1]) {
        const alarm = clockHours(target.start + duration + off);
        const delay = alarmDelay(target.start, alarm);
        const t = createTimeTimer(target, 2, { stopAt: delay });
        while (!t.done()) t.tick(16);
        const want = off < 0 ? 'pale' : 'brule';
        // an alarm on (or before) the start time rings a full turn later: burnt, never stuck
        assert.equal(judgeAmount(t.amount(), w), duration + off <= 0 ? 'brule' : want, `gw ${gw} dur ${duration} off ${off}`);
      }
      const t = createTimeTimer(target, 2, { stopAt: alarmDelay(target.start, rightAlarm(target)) });
      while (!t.done()) t.tick(16);
      assert.equal(judgeAmount(t.amount(), w), 'dore');
    }
  }
});

test('N3: the clock runs 1 h in 6 s x the anim factor and stops at the alarm or after CLOCK_EXTRA', () => {
  for (const anim of [1, 1.5]) {
    const target = { kind: 'clock', heat: 2, start: 2, duration: 1 };
    const t = createTimeTimer(target, 2, { anim });
    for (let ms = 0; ms < HOUR_MS * anim; ms += 50) t.tick(50);
    near(t.elapsed(), 1, 1e-9);
    for (let i = 0; i < 10000; i++) t.tick(100);
    near(t.elapsed(), 1 + CLOCK_EXTRA);
    assert.ok(t.done());
  }
  const t = createTimeTimer({ kind: 'clock', heat: 2, start: 2, duration: 1 }, 2, { stopAt: 1.5 });
  for (let i = 0; i < 10000; i++) t.tick(100);
  near(t.elapsed(), 1.5);
});

test('N2: one number per 3 s at any heat, the cake cooks by heat; the hand stops at NUMBER_MAX', () => {
  const target = bakeTarget('gateau', 2);
  const right = createTimeTimer(target, 2);
  const hot = createTimeTimer(target, 3);
  for (let ms = 0; ms < NUMBER_UNIT_MS * 3; ms += 16) { right.tick(16); hot.tick(16); }
  near(right.elapsed(), hot.elapsed(), 1e-9);
  const w = bakeWindow(target);
  assert.equal(judgeAmount(right.amount(), w), 'dore');
  assert.equal(judgeAmount(hot.amount(), w), 'brule');
  assert.equal(hot.amount(), right.amount() * heatFactor(3, 2));
  const before = right.elapsed();
  right.tick(60000);
  near(right.elapsed() - before, 100 / NUMBER_UNIT_MS, 1e-9); // clamped frame
  for (let i = 0; i < 10000; i++) right.tick(100);
  assert.equal(right.elapsed(), NUMBER_MAX);
});

test('I3: wrong flames are never golden, whatever the time (N2 and N3, every pace)', () => {
  for (const gw of PACES) {
    for (const d of Object.keys(DESSERTS)) {
      const want = DESSERTS[d].heat;
      for (const target of [bakeTarget(d, 2), { ...bakeTarget(d, 3, { rng: () => 0.3 }) }]) {
        const w = bakeWindow(target, { greenWindow: gw });
        for (const heat of [1, 2, 3]) {
          for (let a = 0; a <= 15; a += 0.01) {
            const st = judgeTimed(a, w, heat, want);
            assert.equal(st, bakeState(timedGauge(a, w, heat, want)), 'the look is the judgement');
            if (heat === want) assert.equal(st, judgeAmount(a, w));
            else assert.notEqual(st, 'dore', `${d} ${target.kind} heat ${heat} amount ${a.toFixed(2)}`);
          }
        }
      }
    }
  }
  // the review's cases: a wrong alarm masked by too few flames
  const t3 = { kind: 'clock', heat: 2, start: 4, duration: 1 };
  const timer = createTimeTimer(t3, 1, { stopAt: alarmDelay(4, 6) }); // 1 flame (x0.5), alarm +1 h too late (2 h)
  while (!timer.done()) timer.tick(16);
  assert.equal(judgeTimed(timer.amount(), bakeWindow(t3), 1, 2), 'pale');
  const tarte = { kind: 'clock', heat: 3, start: 2, duration: 1 };
  const t2 = createTimeTimer(tarte, 1, { stopAt: alarmDelay(2, 6) }); // 1 flame (x0.25), alarm +4 h: stops at 3 h
  while (!t2.done()) t2.tick(16);
  assert.equal(judgeTimed(t2.amount(), bakeWindow(tarte), 1, 3), 'pale');
  // N2 at calme, 1 flame, never taken out
  const g2 = bakeTarget('gateau', 2);
  const t4 = createTimeTimer(g2, 1, { anim: 1.5 });
  while (!t4.done()) t4.tick(16);
  assert.notEqual(judgeTimed(t4.amount(), bakeWindow(g2, { greenWindow: 1.5 }), 1, 2), 'dore');
});

test('N3: the oven stopped by the cap is not the alarm ringing', () => {
  const target = { kind: 'clock', heat: 2, start: 2, duration: 1 };
  assert.equal(createTimeTimer(target, 2, { stopAt: 1 }).alarmReached, true);
  assert.equal(createTimeTimer(target, 2, { stopAt: 1 + CLOCK_EXTRA }).alarmReached, true);
  assert.equal(createTimeTimer(target, 2, { stopAt: 5 }).alarmReached, false);
  assert.equal(createTimeTimer(target, 2).alarmReached, false);
});

test('amountGauge: the cake looks as judged (window -> green band), monotonic, 0..1', () => {
  for (const gw of PACES) {
    const w = bakeWindow(bakeTarget('tarte', 2), { greenWindow: gw });
    let prev = -1;
    for (let a = 0; a <= 8; a += 0.01) {
      const g = amountGauge(a, w);
      assert.ok(g >= prev && g >= 0 && g <= 1);
      prev = g;
      const j = judgeAmount(a, w);
      if (Math.abs(a - w.lo) > 1e-6 && Math.abs(a - w.hi) > 1e-6) assert.equal(bakeState(g), j, `a ${a}`);
    }
  }
});

test('clock helpers: snapping, delays, the right alarm', () => {
  const at = h => (h / 12) * 2 * Math.PI;
  assert.equal(angleToAlarm(at(3.2)), 3);
  assert.equal(angleToAlarm(at(3.6)), 4);
  assert.equal(angleToAlarm(at(3.6), true), 3.5);
  assert.equal(angleToAlarm(at(0.1)), 12);
  assert.equal(angleToAlarm(at(11.8)), 12);
  assert.equal(alarmDelay(2, 3), 1);
  assert.equal(alarmDelay(10, 1), 3);
  assert.equal(alarmDelay(3, 3), 12);
  assert.equal(rightAlarm({ start: 10, duration: 1 }), 11);
  assert.equal(rightAlarm({ start: 10, duration: 0.5 }), 10.5);
  assert.equal(rightAlarm({ start: 11, duration: 1 }), 12);
});
