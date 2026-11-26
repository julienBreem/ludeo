import test from 'node:test';
import assert from 'node:assert/strict';
import { cutMarks, snapCut } from '../../jeux/peche-cuisine/src/logic/cutting.js';

test('cutMarks(5) = [0.2,0.4,0.6,0.8], cutMarks(1) = []', () => {
  assert.deepEqual(cutMarks(5), [1 / 5, 2 / 5, 3 / 5, 4 / 5]);
  assert.deepEqual(cutMarks(1), []);
  assert.equal(cutMarks(10).length, 9);
});

test('snapCut snaps within half a portion', () => {
  const marks = cutMarks(5);
  assert.equal(snapCut(0.22, marks, []), 0);
  assert.equal(snapCut(0.5, marks, []), 1);
  assert.equal(snapCut(0.79, marks, []), 3);
});

test('snapCut ignores done marks', () => {
  const marks = cutMarks(5);
  assert.equal(snapCut(0.21, marks, [0]), -1);
  assert.equal(snapCut(0.33, marks, [0]), 1);
});

test('snapCut returns -1 far away', () => {
  assert.equal(snapCut(0.0, cutMarks(5), []), -1);
  assert.equal(snapCut(0.5, [], []), -1);
});
