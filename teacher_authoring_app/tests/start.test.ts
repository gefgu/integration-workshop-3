import assert from 'node:assert/strict';
import test from 'node:test';
import { circuitL04 } from '../src/curriculum/circuits.ts';
import { placementError } from '../src/engine/board.ts';
import { diagnose } from '../src/engine/diagnose.ts';
import { makeStart } from '../src/model/start.ts';
import { needsBuild, startPieces } from '../src/model/steps.ts';

const lessonWith = (start) => ({ kind: 'challenge', board: { pieces: circuitL04() }, start }) as never;

test('each fault turns the finished circuit into something a student has to fix', () => {
  const board = circuitL04();
  const { start: reversed } = makeStart(board, ['reverse_led']);
  assert.equal(diagnose(reversed.pieces).code, 'led_invertido');
  const { start: missing } = makeStart(board, ['remove_jumper']);
  assert.deepEqual(missing.removeOneOf, ['w1', 'w2']);
  assert.equal(diagnose(startPieces(lessonWith(missing), () => 0)).code, 'aberto');
  const { start: loose } = makeStart(board, ['loose']);
  assert.ok(loose.pieces.some((p) => p.loose));
  const { start: short } = makeStart(board, ['short']);
  assert.equal(diagnose(short.pieces).code, 'curto');
  const placed = [];
  for (const p of short.pieces) {
    assert.equal(placementError(placed, p), null, p.id);
    placed.push(p);
  }
  assert.ok(needsBuild(lessonWith(short)));
});

test('faults that do not fit are reported, not silently dropped; the original is untouched', () => {
  const board = circuitL04().filter((p) => p.type !== 'led');
  const before = JSON.stringify(board);
  const { skipped } = makeStart(board, ['reverse_led']);
  assert.deepEqual(skipped, ['reverse_led']);
  assert.equal(JSON.stringify(board), before);
});

test('two faults combine (lesson 9 challenge: a short and a loose part)', () => {
  const { start } = makeStart(circuitL04(), ['loose', 'short']);
  assert.ok(start.pieces.some((p) => p.loose) && diagnose(start.pieces).code === 'curto');
});
