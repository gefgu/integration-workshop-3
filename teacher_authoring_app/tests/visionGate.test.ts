import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { stepVisionBlocked } from '../src/player/visionGate.ts';

test('held observations permit intermediate progress but block final power', () => {
  assert.equal(stepVisionBlocked(false, true, false), false);
  assert.equal(stepVisionBlocked(true, true, false), true);
});

test('invalid or unidentified observations block every stage', () => {
  assert.equal(stepVisionBlocked(false, true, true), true);
  assert.equal(stepVisionBlocked(true, true, true), true);
  assert.equal(stepVisionBlocked(true, false, false), false);
});
