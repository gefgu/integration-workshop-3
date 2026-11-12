import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { stepVisionBlocked } from '../src/player/visionGate.ts';

test('held observations permit progress and final approval', () => {
  assert.equal(stepVisionBlocked(false, true, false), false);
  assert.equal(stepVisionBlocked(true, true, false), false);
});

test('invalid or unidentified observations block every stage', () => {
  assert.equal(stepVisionBlocked(false, true, true), true);
  assert.equal(stepVisionBlocked(true, true, true), true);
  assert.equal(stepVisionBlocked(true, false, false), false);
});
