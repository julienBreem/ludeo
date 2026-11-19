import test from 'node:test';
import assert from 'node:assert/strict';
import { createStirTracker, TURNS_NEEDED } from '../jeux/stand-desserts/src/logic/stir.js';

function circle(t, from, to, step = 0.2, r = 100) {
  const dir = to >= from ? 1 : -1;
  for (let a = from; dir * (to - a) >= -0.0001; a += dir * step) t.addPoint(r * Math.cos(a), r * Math.sin(a));
}

test('TURNS_NEEDED is 4', () => assert.equal(TURNS_NEEDED, 4));

test('four full circles complete the stir', () => {
  const t = createStirTracker(0, 0);
  for (let a = 0; a <= 8 * Math.PI + 0.01; a += 0.2) t.addPoint(100 * Math.cos(a), 100 * Math.sin(a));
  t.addPoint(100, 0); // loop stops at ~25.0 rad; close the last circle at 8π
  assert.equal(t.progress(), 1);
});

test('two circles = half', () => {
  const t = createStirTracker(0, 0);
  circle(t, 0, 4 * Math.PI);
  assert.ok(Math.abs(t.progress() - 0.5) <= 0.02, String(t.progress()));
});

test('counter-clockwise counts the same', () => {
  const t = createStirTracker(0, 0);
  circle(t, 0, -(8 * Math.PI + 0.01));
  t.addPoint(100, 0); // close the last circle at -8π
  assert.equal(t.progress(), 1);
});

test('wiggling back and forth does not progress', () => {
  const t = createStirTracker(0, 0);
  for (let i = 0; i < 50; i++) {
    t.addPoint(100 * Math.cos(0.5), 100 * Math.sin(0.5));
    t.addPoint(100, 0);
  }
  assert.ok(t.progress() < 0.05, String(t.progress()));
});

test('points near the centre are ignored', () => {
  const t = createStirTracker(0, 0);
  circle(t, 0, 8 * Math.PI, 0.2, 10);
  assert.equal(t.progress(), 0);
});

test('points near the centre break the chain', () => {
  const t = createStirTracker(0, 0);
  t.addPoint(100, 0);
  t.addPoint(1, 0); // breaks
  t.addPoint(-100, 0); // only sets a new reference, no half-turn added
  assert.equal(t.progress(), 0);
});

test('breakStroke does not lose progress', () => {
  const t = createStirTracker(0, 0);
  circle(t, 0, 4 * Math.PI);
  t.breakStroke();
  circle(t, 1, 1 + 4 * Math.PI);
  assert.ok(t.progress() >= 0.98, String(t.progress()));
});

test('breakStroke drops the reference so the jump is not counted', () => {
  const t = createStirTracker(0, 0);
  t.addPoint(100, 0);
  t.breakStroke();
  t.addPoint(0, 100);
  assert.equal(t.progress(), 0);
});

test('reset zeroes everything', () => {
  const t = createStirTracker(0, 0);
  circle(t, 0, 4 * Math.PI);
  t.reset();
  assert.equal(t.progress(), 0);
});
