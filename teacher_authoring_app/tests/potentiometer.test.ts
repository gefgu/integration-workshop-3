import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PieceView from '../src/components/PieceView.tsx';
import SchematicPreview from '../src/components/SchematicPreview.tsx';
import { buildPiece, flip, span } from '../src/engine/board.ts';
import { columnVoltages } from '../src/engine/capsules.ts';
import { analyze, corrente, solvePotCircuit } from '../src/engine/sim.ts';
import { potResistances } from '../src/engine/potentiometer.ts';
import { newLesson, validateLesson } from '../src/model/lesson.ts';
import type { Piece } from '../src/model/types.ts';

const divider = (value: number, led = false): Piece[] => [
  { id: 'bat', type: 'bateria', a: 1, b: 2, row: 0 },
  { id: 'pot', type: 'potenciometro', a: 3, b: 5, c: 4, row: 2, value },
  { id: 'plus', type: 'jumper_longo', a: 1, b: 3, row: 4 },
  { id: 'return', type: 'jumper_3', a: 5, b: 2, row: 5 },
  ...(led ? [{ id: 'led', type: 'led' as const, a: 4, b: 5, row: 3 }] : []),
];
const near = (actual: number | undefined, expected: number) =>
  assert.ok(actual != null && Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

test('potentiometers occupy three sockets and keep the middle wiper when reversed', () => {
  const p = buildPiece('potenciometro', 'pot', 3, 2)!;
  assert.deepEqual({ a: p.a, b: p.b, c: p.c }, { a: 3, b: 5, c: 4 });
  assert.deepEqual(span(p), [3, 5]);
  assert.deepEqual(flip(p), { ...p, a: 5, b: 3 });
  const reverse = buildPiece('potenciometro', 'pot', 5, 2, -1)!;
  assert.deepEqual({ a: reverse.a, b: reverse.b, c: reverse.c }, { a: 5, b: 3, c: 4 });
});

test('the outer track stays 10k while the unloaded wiper divides its voltage', () => {
  for (const setting of [0, 1000, 5000, 10000]) {
    const p = divider(setting);
    near(analyze(p).ohms, 10000);
    near(columnVoltages(p).get(4), 5 * (1 - setting / 10000));
    const r = potResistances({ value: setting });
    assert.equal(r.aw + r.wb, r.total);
  }
});

test('two 5k sections supply a loaded 0.2mA ideal LED, not the unloaded divider voltage', () => {
  const p = divider(5000, true);
  const analysis = analyze(p);
  assert.equal(analysis.code, 'valido');
  near(corrente(analysis), 0.2);
  near(columnVoltages(p).get(4), 2);
  near(solvePotCircuit(p)!.currents.get('pot:AW'), 0.0006);
  near(solvePotCircuit(p)!.currents.get('pot:WB'), 0.0004);
  assert.equal(analyze(divider(9000, true)).code, 'tensao_baixa');
  near(columnVoltages(divider(9000, true)).get(4), 0.5);
});

test('an unused outer end adds no resistance to the wiper branch', () => {
  const p: Piece[] = [
    { id: 'bat', type: 'bateria', a: 1, b: 2, row: 0 },
    { id: 'pot', type: 'potenciometro', a: 3, b: 5, c: 4, row: 1, value: 500 },
    { id: 'plus', type: 'jumper_longo', a: 1, b: 3, row: 5 },
    { id: 'wiper', type: 'jumper_longo', a: 4, b: 6, row: 2 },
    { id: 'led', type: 'led', a: 6, b: 7, row: 3 },
    { id: 'return', type: 'jumper_5', a: 7, b: 2, row: 4 },
  ];
  near(corrente(analyze(p)), 6);
  near(columnVoltages(p).get(5), 2);
});

test('legacy geometry loads with inferred W and preserves a zero setting', () => {
  const lesson = newLesson();
  lesson.board.pieces = [{ id: 'pot', type: 'potenciometro', a: 3, b: 5, row: 2, value: 0 }];
  const result = validateLesson(lesson);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.lesson.board.pieces[0], { ...lesson.board.pieces[0], c: 4 });
  lesson.board.pieces[0].c = 3;
  assert.equal(validateLesson(lesson).ok, false);
});

test('board and schematic show the connected third contact', () => {
  const body = renderToStaticMarkup(createElement(PieceView, { type: 'potenciometro', width: 114, value: 0 }));
  for (const label of ['Terminal A', 'Terminal W, cursor', 'Terminal B']) assert.ok(body.includes(label));
  const schema = renderToStaticMarkup(createElement(SchematicPreview, { pieces: divider(1000, true) }));
  assert.match(schema, /data-terminal="W"/);
  assert.match(schema, /W \(cursor\) col\. 4/);
});

test('stepping a continuous setting moves in the requested direction and preserves zero', async () => {
  const { stepPotValue } = await import('../src/engine/potentiometer.ts');
  assert.equal(stepPotValue(1500, 1), 2200);
  assert.equal(stepPotValue(1500, -1), 1000);
  assert.equal(stepPotValue(0, -1), 0);
  assert.equal(stepPotValue(0, 1), 100);
  assert.equal(stepPotValue(10000, 1), 10000);
});
