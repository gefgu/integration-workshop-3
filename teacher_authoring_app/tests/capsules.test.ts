import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPiece, placementError } from '../src/engine/board.ts';
import { columnVoltages, simulateCapsules } from '../src/engine/capsules.ts';
import { nodeOf, slotAnchor, slotOf } from '../src/engine/nodes.ts';
import { analyze, configProblems, nextConfig } from '../src/engine/sim.ts';
import { newLesson, validateLesson } from '../src/model/lesson.ts';

const P = (id, type, a, b, row = 0, extra = {}) => ({ id, type, a, b, row, ...extra });
const cap = (id, type, a, row, config?) => P(id, type, a, a + 1, row, { c: a + 2, ...(config ? { config } : {}) });

// Bank A loop: bat + on col 1, − on col 2. + → R220 (col 1→3) → LED (col 3→4) → wire back to col 2.
// R drops 3 V (13,6 mA), so col 1 = 5 V, col 3 = 2 V and col 4 = 0 V.
const loop = () => [
  P('bat', 'bateria', 1, 2, 1),
  P('r', 'resistor_220', 1, 3, 2),
  P('led', 'led', 3, 4, 3),
  P('j', 'jumper_longo', 4, 2, 4),
];
// Capsule in slot 3 (bank A, columns 9-11); the wires bring P1/P2 to the nodes being measured.
const slot3 = (id, type, config?) => cap(id, type, 9, 0, config);

test('voltímetro lê a queda de tensão no resistor', () => {
  const v = columnVoltages(loop());
  assert.equal(v.get(nodeOf(1, 1)), 5);
  assert.ok(Math.abs((v.get(nodeOf(3, 1)) as number) - 2) < 0.01);
  const floating = simulateCapsules([...loop(), slot3('m', 'capsula_voltimetro')]);
  assert.equal(floating.readings.m.lines[1], 'sem sinal'); // pinos soltos
  const wired = [
    ...loop(),
    slot3('m', 'capsula_voltimetro'),
    P('w1', 'jumper_longo', 1, 9, 5), // P1 ← + (5 V)
    P('w2', 'jumper_longo', 3, 10, 5), // P2 ← node after the resistor (2 V)
  ];
  assert.equal(simulateCapsules(wired).readings.m.lines[1], '3,00 V');
});

test('voltímetro lê um circuito fechado só com resistores', () => {
  const resistors = [
    P('bat', 'bateria', 1, 2, 1),
    P('r1', 'resistor_220', 1, 3, 2),
    P('r2', 'resistor_470', 3, 2, 3),
  ];
  assert.equal(analyze(resistors).code, 'sem_led');
  const measured = simulateCapsules([
    ...resistors,
    slot3('m', 'capsula_voltimetro'),
    P('w1', 'jumper_longo', 1, 9, 5), // P1 ← battery positive
    P('w2', 'jumper_longo', 3, 10, 5), // P2 ← midpoint between resistors
  ]);
  assert.equal(measured.readings.m.lines[1], '1,59 V');
});

test('pulso é a fonte: P3 alimenta a carga e o retorno volta pela P1', () => {
  const board = [
    slot3('p', 'capsula_pulso', { hz: 1, duty: 50 }), // P1 = column 9 (GND), P3 = column 11
    P('r', 'resistor_220', 11, 8, 2),
    P('led', 'led', 8, 9, 3),
  ];
  const high = simulateCapsules(board, { t: 100 });
  const low = simulateCapsules(board, { t: 700 });
  assert.equal(high.readings.p.out, 'alto');
  assert.equal(low.readings.p.out, 'baixo');
  assert.ok(high.driven?.edgeIds.has('led'));
  assert.ok(Math.abs(high.drivenMa - 13.6) < 0.1);
  assert.equal(low.driven, null);
  // without a way back to P1 nothing lights
  const open = board.map((p) => (p.id === 'led' ? { ...p, b: 7 } : p));
  assert.equal(simulateCapsules(open, { t: 100 }).driven, null);
  // a load in the other bank is not wired to the capsule
  const other = board.map((p) => (p.id === 'led' || p.id === 'r' ? { ...p, row: p.row + 5 } : p));
  assert.equal(simulateCapsules(other, { t: 100 }).driven, null);
});

test('voltímetro lê o pulso sem bateria', () => {
  const board = [
    slot3('p', 'capsula_pulso', { hz: 1, duty: 50 }),
    P('r', 'resistor_220', 11, 8, 2),
    P('led', 'led', 8, 9, 3),
    cap('m', 'capsula_voltimetro', 5, 0),
    P('w1', 'jumper_5', 11, 6, 4), // P2 do voltímetro ← P3 do pulso
    P('w2', 'jumper_4', 9, 5, 5), // P1 do voltímetro ← P1 (GND) do pulso
  ];
  assert.equal(simulateCapsules(board, { t: 100 }).readings.m.lines[1], '-5,00 V');
  assert.equal(simulateCapsules(board, { t: 700 }).readings.m.lines[1], '0,00 V');
});

test('pulso e bateria não ficam juntos na bancada nem na lição', () => {
  const pulse = slot3('p', 'capsula_pulso');
  assert.match(placementError([P('bat', 'bateria', 1, 2, 1)], pulse) as string, /bateria/);
  assert.match(placementError([pulse], P('bat', 'bateria', 1, 2, 1)) as string, /bateria/);
  assert.equal(placementError([cap('m', 'capsula_voltimetro', 1, 0)], pulse), null);
  const l = newLesson();
  l.id = 'x';
  l.board.pieces = [pulse] as any;
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, true);
  l.board.pieces = [pulse, P('bat', 'bateria', 1, 2, 1)] as any;
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
  l.board.pieces = [pulse] as any;
  l.settings = { tray: ['bateria', 'led'] };
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
  l.settings = { tray: ['capsula_pulso', 'led'] };
  l.start = { pieces: [P('bat', 'bateria', 1, 2, 1)] as any };
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
});

test('só existem as cápsulas de pulso e voltímetro', () => {
  const l = newLesson();
  for (const type of ['capsula_amperimetro', 'capsula_porta', 'capsula_memoria']) {
    l.board.pieces = [cap('x', type, 5, 0)] as any;
    assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
  }
});

test('os bancos A e B são nós separados', () => {
  assert.equal(analyze(loop()).code, 'valido');
  const split = loop().map((p) => (p.id === 'led' ? { ...p, row: 8 } : p));
  assert.notEqual(analyze(split).code, 'valido'); // LED in bank B is not wired to bank A
  assert.notEqual(nodeOf(3, 0), nodeOf(3, 6));
});

test('cápsula só cabe nos 6 encaixes', () => {
  assert.deepEqual(slotAnchor(1), { a: 1, row: 0 });
  assert.deepEqual(slotAnchor(6), { a: 9, row: 6 });
  assert.equal(slotOf({ a: 5, row: 6 }), 5);
  assert.equal(slotOf({ a: 2, row: 0 }), null);
  // dropping anywhere snaps to the nearest slot of that bank
  const snapped = buildPiece('capsula_voltimetro', 'x', 11, 3);
  assert.deepEqual([snapped?.a, snapped?.b, snapped?.c, snapped?.row], [9, 10, 11, 0]);
  const low = buildPiece('capsula_voltimetro', 'x', 6, 8);
  assert.deepEqual([low?.a, low?.row], [5, 6]);
  assert.match(placementError([], cap('x', 'capsula_voltimetro', 2, 0)) as string, /6 encaixes/);
  assert.equal(placementError([], cap('x', 'capsula_voltimetro', 5, 0)), null);
  const three = [
    cap('c1', 'capsula_voltimetro', 1, 0),
    cap('c2', 'capsula_voltimetro', 5, 0),
    cap('c3', 'capsula_voltimetro', 1, 6),
  ];
  assert.match(placementError(three, cap('d', 'capsula_voltimetro', 1, 6)) as string, /No máximo 3/);
  assert.match(
    placementError([cap('a', 'capsula_voltimetro', 1, 0)], P('r', 'resistor_220', 2, 3, 0)) as string,
    /Já existe/
  );
});

test('configuração: faixas e ciclo de ajustes', () => {
  assert.deepEqual(configProblems('capsula_pulso', { hz: 2, duty: 50 }), []);
  assert.ok(configProblems('capsula_pulso', { hz: 50 }).length);
  assert.ok(configProblems('capsula_voltimetro', { op: 'xnor' }).length);
  assert.ok(configProblems('led', { hz: 1 }).length);
  assert.equal(nextConfig(cap('p', 'capsula_pulso', 1, 0, { duty: 75 }), 'duty')?.duty, 25);
  assert.equal(nextConfig(cap('p', 'capsula_pulso', 1, 0, { hz: 10 }))?.hz, 0.5);
  assert.equal(nextConfig(cap('v', 'capsula_voltimetro', 1, 0)), undefined);
});

test('validateLesson mantém c e config e recusa cápsulas malformadas', () => {
  const l = newLesson();
  l.id = 'x';
  l.board.pieces = [cap('g', 'capsula_pulso', 5, 0, { hz: 2, duty: 25 })] as any;
  const ok: any = validateLesson(JSON.parse(JSON.stringify(l)));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.lesson.board.pieces[0].config, { hz: 2, duty: 25 });
  assert.equal(ok.lesson.board.pieces[0].c, 7);
  l.board.pieces = [P('g', 'capsula_voltimetro', 5, 6, 0, { c: 9 })] as any;
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
  l.board.pieces = [cap('g', 'capsula_pulso', 5, 0, { hz: 50 })] as any;
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
});

test('validateLesson recusa cápsula fora dos encaixes', () => {
  const l = newLesson();
  l.board.pieces = [cap('g', 'capsula_voltimetro', 3, 0)] as any;
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
});
