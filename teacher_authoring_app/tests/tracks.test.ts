import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnose } from '../src/engine/diagnose.ts';
import { nodeOf } from '../src/engine/nodes.ts';
import { flowSegments, legColumns, trackLights } from '../src/engine/tracks.ts';
import type { Piece } from '../src/model/types.ts';

const piece = (id: string, type: string, a: number, b: number, row: number, c?: number) =>
  ({ id, type, a, b, row, ...(c != null ? { c } : {}) }) as Piece;

test('trilhas acesas: cada perna acende a trilha do seu banco; duas peças na mesma trilha ficam ligadas', () => {
  const lights = trackLights([
    piece('bat', 'bateria', 1, 2, 0),
    piece('led', 'led', 2, 3, 3),
    piece('r', 'resistor_220', 2, 3, 8),
  ]);
  // column 2 of bank A joins the battery and the LED; column 2 of bank B is a different track
  assert.deepEqual(lights.get(nodeOf(2, 0))?.pieces, ['bat', 'led']);
  assert.deepEqual(lights.get(nodeOf(2, 0))?.rows, [0, 3]);
  assert.deepEqual(lights.get(nodeOf(2, 6))?.pieces, ['r']);
  assert.equal(lights.get(nodeOf(1, 0))?.pieces.length, 1);
  assert.equal(lights.has(nodeOf(4, 0)), false);
  assert.equal(lights.size, 5);
});

test('fio longo liga só as pontas; cápsula inteligente acende as três trilhas', () => {
  assert.deepEqual(legColumns(piece('j', 'jumper_longo', 4, 6, 1)), [4, 6]);
  assert.deepEqual(legColumns(piece('c', 'capsula_pulso', 1, 2, 0, 3)), [1, 2, 3]);
  const lights = trackLights([piece('j', 'jumper_longo', 4, 6, 1)]);
  assert.equal(lights.has(nodeOf(5, 1)), false);
});

test('setas de energia: só entre a perna que traz a corrente e a que leva, no sentido da corrente', () => {
  // battery + on column 1 row 0, LED from column 1 (row 3) to column 2, resistor from column 2 (row 1) back to −
  const pieces = [
    piece('bat', 'bateria', 1, 3, 0),
    piece('led', 'led', 1, 2, 3),
    piece('r', 'resistor_220', 2, 3, 1),
  ];
  const diag = diagnose(pieces);
  assert.equal(diag.code, 'valido');
  const segs = flowSegments(pieces, diag.trail?.flow ?? []);
  const at = (col: number) => segs.filter((s) => s.node === nodeOf(col, 0)).map((s) => [s.fromRow, s.toRow]);
  // + leaves the battery at row 0 and enters the LED at row 3: rows 4 and 5 stay without an arrow
  assert.deepEqual(at(1), [[0, 3]]);
  // the LED hands the current to the resistor upwards (row 3 → row 1)
  assert.deepEqual(at(2), [[3, 1]]);
  // the resistor brings it back to the battery's − leg
  assert.deepEqual(at(3), [[1, 0]]);
  assert.equal(segs.length, 3);
});
