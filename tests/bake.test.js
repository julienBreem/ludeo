import test from 'node:test';
import assert from 'node:assert/strict';
import { bakeRate, createBakeTimer, MAX_DT, GREEN_MIN, GREEN_MAX } from '../src/logic/bake.js';

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
