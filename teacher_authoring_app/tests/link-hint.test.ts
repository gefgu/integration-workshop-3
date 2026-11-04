import assert from 'node:assert/strict';
import { test } from 'node:test';
import { circuitL02, circuitL04, circuitL05, circuitL10 } from '../src/curriculum/circuits.ts';
import { missingLink } from '../src/engine/linkHint.ts';

const without = (pieces: ReturnType<typeof circuitL04>, id: string) => pieces.filter((p) => p.id !== id);
const piece = (pieces: ReturnType<typeof circuitL04>, id: string) => {
  const found = pieces.find((p) => p.id === id);
  if (!found) throw new Error(id);
  return found;
};

test('a finished circuit has nothing to draw', () => {
  assert.equal(missingLink(circuitL04(), circuitL04()), null);
});

test('missing return jumper: the line leaves the LED cathode and points at the battery −', () => {
  const target = circuitL04();
  const hint = missingLink(without(target, 'w2'), target);
  assert.ok(hint);
  const led = piece(target, 'led');
  const bat = piece(target, 'bat');
  assert.deepEqual(hint.from, { col: led.b, row: led.row });
  assert.deepEqual(hint.to, { col: bat.b, row: bat.row });
  assert.equal(hint.fromId, 'led');
  assert.equal(hint.toId, 'bat');
});

test('missing first jumper: the line leaves the resistor and points at the battery +', () => {
  const target = circuitL04();
  const hint = missingLink(without(target, 'w1'), target);
  assert.ok(hint);
  const res = piece(target, 'res');
  const bat = piece(target, 'bat');
  assert.deepEqual(hint.from, { col: res.a, row: res.row });
  assert.deepEqual(hint.to, { col: bat.a, row: bat.row });
});

test('lesson 2: the loose LED anode is sent to the battery +', () => {
  const target = circuitL02();
  const hint = missingLink(without(target, 'w1'), target);
  assert.ok(hint);
  assert.equal(hint.toId, 'bat');
  assert.deepEqual(hint.to, { col: piece(target, 'bat').a, row: piece(target, 'bat').row });
});

test('position independent: the same circuit built three columns to the right', () => {
  const target = circuitL04();
  const moved = without(target, 'w2').map((p) => ({ ...p, a: p.a + 3, b: p.b + 3 }));
  const hint = missingLink(moved, target);
  assert.ok(hint);
  assert.equal(hint.from.col, piece(target, 'led').b + 3);
  assert.equal(hint.to.col, piece(target, 'bat').b + 3);
});

test('no hint when a piece is missing, extra, or the wrong value', () => {
  const target = circuitL04();
  assert.equal(missingLink(without(target, 'led'), target), null);
  assert.equal(missingLink([...target, { id: 'x', type: 'led', a: 8, b: 9, row: 3 }], target), null);
  assert.equal(
    missingLink(
      target.map((p) => (p.id === 'res' ? { ...p, type: 'resistor_220' as const } : p)),
      target
    ),
    null
  );
});

test('two buttons in series: the dangling button is the destination', () => {
  const target = circuitL05();
  const hint = missingLink(without(target, 'w2'), target);
  assert.ok(hint);
  assert.equal(hint.toId, 'bat');
});

test('the alarm with two branches yields a hint for a missing branch jumper', () => {
  const target = circuitL10();
  const hint = missingLink(without(target, 'w4'), target);
  assert.ok(hint);
  assert.ok(['led', 'buz'].includes(hint.fromId) || ['led', 'buz'].includes(hint.toId));
});
