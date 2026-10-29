import assert from 'node:assert/strict';
import test from 'node:test';
import { CC_DEFAULT, CC_VALUES, ccDiscs, ccOhms, KIT_LIMITS, pieceOhms, turnCcDisc } from '../src/engine/sim.ts';
import { newLesson, validateLesson } from '../src/model/lesson.ts';

test('discos do resistor de código de cores formam os valores do kit', () => {
  assert.equal(ccOhms(ccDiscs(220)), 220);
  assert.equal(ccOhms(ccDiscs(470)), 470);
  assert.equal(ccOhms(ccDiscs(1000)), 1000);
  assert.equal(ccDiscs(333), null);
  assert.ok(CC_VALUES.includes(CC_DEFAULT));
  assert.equal(KIT_LIMITS.resistor_cc, 1);
});

test('girar um disco anda uma posição e volta ao início', () => {
  let ohms = 220; // vermelho vermelho marrom
  ohms = turnCcDisc(ohms, 2); // marrom -> vermelho: ×100
  assert.equal(ohms, 2200);
  for (let i = 0; i < 3; i++) ohms = turnCcDisc(ohms, 2);
  assert.equal(ohms, 220);
  assert.equal(turnCcDisc(undefined, 0), 420);
});

test('resistência da peça e valor salvo na lição', () => {
  const piece = { id: 'r', type: 'resistor_cc' as const, a: 1, b: 2, row: 0 };
  assert.equal(pieceOhms(piece), CC_DEFAULT);
  assert.equal(pieceOhms({ ...piece, value: 4700 }), 4700);
});

test('importar lição preserva o valor dos discos e descarta valores impossíveis', () => {
  const lesson = (value) => ({
    ...newLesson(),
    board: { pieces: [{ id: 'r', type: 'resistor_cc', a: 1, b: 2, row: 0, value }] },
  });
  const kept = validateLesson(lesson(4700));
  assert.equal(kept.ok, true);
  assert.equal(kept.ok && kept.lesson.board.pieces[0].value, 4700);
  const dropped = validateLesson(lesson(333));
  assert.equal(dropped.ok && dropped.lesson.board.pieces[0].value, undefined);
});
