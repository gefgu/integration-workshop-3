import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPiece, placementError } from '../src/engine/board.ts';
import { columnVoltages, simulateCapsules, stepMemory } from '../src/engine/capsules.ts';
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

test('porta lógica avalia os níveis e aciona P3', () => {
  // P1 ligado ao + (5 V), P2 ligado ao − (0 V)
  const wired = (op) => [
    ...loop(),
    slot3('g', 'capsula_porta', { op }),
    P('w1', 'jumper_longo', 1, 9, 5),
    P('w2', 'jumper_longo', 2, 10, 5),
  ];
  const lines = (op) => simulateCapsules(wired(op)).readings.g.lines[1];
  assert.equal(lines('and'), '1 0 → 0');
  assert.equal(lines('or'), '1 0 → 1');
  assert.equal(lines('nand'), '1 0 → 1');
  assert.equal(lines('xor'), '1 0 → 1');
  assert.equal(lines('not'), '1 → 0');
  assert.equal(simulateCapsules(wired('or')).readings.g.out, 'alto');
});

test('memória D captura na borda do clock e SR liga/desliga', () => {
  let s = { q: false, clk: false };
  s = stepMemory(s, 'd', true, false);
  assert.equal(s.q, false); // sem borda
  s = stepMemory(s, 'd', true, true);
  assert.equal(s.q, true); // borda de subida
  s = stepMemory(s, 'd', false, true);
  assert.equal(s.q, true); // clock ainda alto: segura
  s = stepMemory({ q: true, clk: false }, 'sr', false, true);
  assert.equal(s.q, false); // R
  s = stepMemory(s, 'sr', true, false);
  assert.equal(s.q, true); // S
});

test('pulso alterna P3 com o relógio e liga a carga ligada em P3', () => {
  const board = [
    P('bat', 'bateria', 1, 2, 1),
    slot3('p', 'capsula_pulso', { hz: 1, duty: 50 }), // P3 = column 11
    P('r', 'resistor_220', 11, 8, 2),
    P('led', 'led', 8, 2, 3),
  ];
  const high = simulateCapsules(board, { t: 100 });
  const low = simulateCapsules(board, { t: 700 });
  assert.equal(high.readings.p.out, 'alto');
  assert.equal(low.readings.p.out, 'baixo');
  assert.ok(high.driven?.edgeIds.has('led'));
  assert.equal(low.driven, null);
  // a load in the other bank cannot return to the battery's − node
  const other = board.map((p) => (p.id === 'led' || p.id === 'r' ? { ...p, row: p.row + 5 } : p));
  assert.equal(simulateCapsules(other, { t: 100 }).driven, null);
});

test('amperímetro em série mede a corrente e dispara acima de 15 mA', () => {
  const amm = () => cap('a', 'capsula_amperimetro', 5, 0); // slot 2: P1 col 5, P2 col 6
  const direct = [
    P('bat', 'bateria', 1, 2, 1),
    P('w1', 'jumper_longo', 1, 5, 2),
    amm(),
    P('led', 'led', 6, 7, 3),
    P('w2', 'jumper_longo', 7, 2, 4),
  ];
  const fault = simulateCapsules(direct);
  assert.equal(fault.readings.a.fault, true); // 3 V / 10 Ω = 300 mA
  assert.equal(fault.readings.a.lines[1], 'DISPAROU');
  const safe = simulateCapsules([
    direct[0],
    direct[1],
    amm(),
    P('r', 'resistor_470', 6, 7, 3),
    P('led', 'led', 7, 8, 4),
    P('w2', 'jumper_4', 8, 2, 5),
  ]);
  assert.equal(safe.readings.a.fault, false);
  assert.match(safe.readings.a.lines[1], /mA$/);
});

test('os bancos A e B são nós separados', () => {
  assert.equal(analyze(loop()).code, 'valido');
  const split = loop().map((p) => (p.id === 'led' ? { ...p, row: 8 } : p));
  assert.notEqual(analyze(split).code, 'valido'); // LED in bank B is not wired to bank A
  assert.notEqual(nodeOf(3, 0), nodeOf(3, 6));
});

test('cápsula só cabe nos 6 encaixes e o amperímetro só no encaixe 2', () => {
  assert.deepEqual(slotAnchor(1), { a: 1, row: 0 });
  assert.deepEqual(slotAnchor(6), { a: 9, row: 6 });
  assert.equal(slotOf({ a: 5, row: 6 }), 5);
  assert.equal(slotOf({ a: 2, row: 0 }), null);
  // dropping anywhere snaps to the nearest slot of that bank
  const snapped = buildPiece('capsula_porta', 'x', 11, 3);
  assert.deepEqual([snapped?.a, snapped?.b, snapped?.c, snapped?.row], [9, 10, 11, 0]);
  const low = buildPiece('capsula_porta', 'x', 6, 8);
  assert.deepEqual([low?.a, low?.row], [5, 6]);
  assert.match(placementError([], cap('x', 'capsula_porta', 2, 0)) as string, /6 encaixes/);
  assert.match(placementError([], cap('x', 'capsula_amperimetro', 9, 0)) as string, /só funciona/);
  assert.equal(placementError([], cap('x', 'capsula_amperimetro', 5, 0)), null);
  const three = [
    cap('c1', 'capsula_voltimetro', 1, 0),
    cap('c2', 'capsula_voltimetro', 5, 0),
    cap('c3', 'capsula_voltimetro', 1, 6),
  ];
  assert.match(placementError(three, cap('d', 'capsula_porta', 1, 6)) as string, /No máximo 3/);
  assert.match(
    placementError([cap('a', 'capsula_porta', 1, 0)], P('r', 'resistor_220', 2, 3, 0)) as string,
    /Já existe/
  );
});

test('configuração: faixas e ciclo de ajustes', () => {
  assert.deepEqual(configProblems('capsula_pulso', { hz: 2, duty: 50 }), []);
  assert.ok(configProblems('capsula_pulso', { hz: 50 }).length);
  assert.ok(configProblems('capsula_porta', { op: 'xnor' }).length);
  assert.ok(configProblems('led', { op: 'and' }).length);
  assert.equal(nextConfig(cap('g', 'capsula_porta', 1, 0, { op: 'not' }))?.op, 'and');
  assert.equal(nextConfig(cap('p', 'capsula_pulso', 1, 0, { hz: 10 }))?.hz, 0.5);
  assert.equal(nextConfig(cap('v', 'capsula_voltimetro', 1, 0)), undefined);
});

test('validateLesson mantém c e config e recusa cápsulas malformadas', () => {
  const l = newLesson();
  l.id = 'x';
  l.board.pieces = [cap('g', 'capsula_porta', 5, 0, { op: 'xor' })] as any;
  const ok: any = validateLesson(JSON.parse(JSON.stringify(l)));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.lesson.board.pieces[0].config, { op: 'xor' });
  assert.equal(ok.lesson.board.pieces[0].c, 7);
  l.board.pieces = [P('g', 'capsula_porta', 5, 6, 0, { c: 9 })] as any;
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
  l.board.pieces = [cap('g', 'capsula_porta', 5, 0, { op: 'nope' })] as any;
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
});

test('validateLesson recusa cápsula fora dos encaixes', () => {
  const l = newLesson();
  l.board.pieces = [cap('g', 'capsula_porta', 3, 0)] as any;
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
  l.board.pieces = [cap('a', 'capsula_amperimetro', 1, 0)] as any;
  assert.equal((validateLesson(JSON.parse(JSON.stringify(l))) as any).ok, false);
});
