import assert from 'node:assert/strict';
import test from 'node:test';
import { nodeOf } from '../src/engine/nodes.ts';
import { legColumns, trackLights } from '../src/engine/tracks.ts';
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
