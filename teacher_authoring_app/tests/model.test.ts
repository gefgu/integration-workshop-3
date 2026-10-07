import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPiece, colX, nearestHole, placementError, rowY } from '../src/engine/board.ts';
import { analyze, corrente, DEFS } from '../src/engine/sim.ts';
import { lessonProblems, newLesson, newQuiz, validateLesson } from '../src/model/lesson.ts';

const P = (id, type, a, b, row = 0) => ({ id, type, a, b, row });

const loop = () => [
  P('bat', 'bateria', 1, 2, 0),
  P('r', 'resistor_470', 2, 3, 1),
  P('led', 'led', 3, 4, 2),
  P('j', 'jumper_longo', 4, 2, 3),
];

test('analyze: bateria → resistor → LED → volta é válido', () => {
  const pieces = [
    P('bat', 'bateria', 1, 2),
    P('r', 'resistor_470', 1, 3),
    P('led', 'led', 3, 4),
    P('w', 'jumper_longo', 4, 2),
  ];
  assert.equal(analyze(pieces).code, 'valido');
});

test('analyze: jumper direto nos polos é curto', () => {
  assert.equal(analyze([P('bat', 'bateria', 1, 2), P('w', 'jumper_curto', 1, 2, 1)]).code, 'par_duplicado');
  assert.equal(
    analyze([P('bat', 'bateria', 1, 2), P('w', 'jumper_curto', 1, 3), P('w2', 'jumper_curto', 3, 2, 1)]).code,
    'curto'
  );
});

test('analyze: sem bateria e sem resistor', () => {
  assert.equal(analyze([]).code, 'sem_bateria');
  const pieces = [P('bat', 'bateria', 1, 2), P('led', 'led', 1, 3), P('w', 'jumper_curto', 3, 2, 1)];
  assert.equal(analyze(pieces).code, 'sem_resistor');
});

test('buildPiece vira para o outro lado quando sai da bancada', () => {
  assert.deepEqual(buildPiece('resistor_470', 'x', 11, 0, 1), { id: 'x', type: 'resistor_470', a: 11, b: 10, row: 0 });
  assert.equal(buildPiece('jumper_longo', 'x', 6, 0, 1).b, 8);
  assert.equal(buildPiece('jumper_3', 'x', 6, 0, 1).b, 9);
});

test('linhas do segundo banco (6–11) são válidas', () => {
  assert.equal(placementError([], P('n', 'resistor_470', 2, 3, 11)), null);
  assert.equal(validateLesson({ ...newLesson(), board: { pieces: [P('a', 'led', 1, 2, 11)] } }).ok, true);
  assert.equal(validateLesson({ ...newLesson(), board: { pieces: [P('a', 'led', 1, 2, 12)] } }).ok, false);
});

test('placementError: limites, sobreposição e bateria única', () => {
  const pieces = [P('bat', 'bateria', 1, 2, 0)];
  assert.match(placementError(pieces, P('n', 'resistor_470', 2, 3, 0)), /Já existe/);
  assert.equal(placementError(pieces, P('n', 'resistor_470', 2, 3, 1)), null);
  assert.match(placementError(pieces, P('n', 'bateria', 5, 6, 4)), /só tem 1/);
  assert.match(placementError(pieces, P('n', 'resistor_470', 11, 12, 1)), /sai da bancada/);
  assert.equal(placementError(pieces, P('bat', 'bateria', 1, 2, 0), 'bat'), null);
});

test('nearestHole encaixa no furo mais próximo e rejeita fora da bancada', () => {
  assert.deepEqual(nearestHole(colX(4) + 5, rowY(3) - 4), { col: 4, row: 3 });
  assert.deepEqual(nearestHole(colX(2), rowY(10) + 3), { col: 2, row: 10 });
  assert.equal(nearestHole(-200, 10), null);
});

test('validateLesson aceita lição válida e rejeita lixo', () => {
  const l = newLesson();
  l.title = 'Acender um LED';
  l.board.pieces = loop();
  l.quizzes = [newQuiz('after')];
  const round = validateLesson(JSON.parse(JSON.stringify(l)));
  assert.equal(round.ok, true);
  assert.deepEqual(round.lesson.board.pieces, l.board.pieces);

  assert.equal(validateLesson(null).ok, false);
  assert.equal(validateLesson({ ...l, version: 99 }).ok, false);
  assert.equal(validateLesson({ ...l, board: { pieces: [P('a', 'smart_capsule', 1, 2)] } }).ok, false);
  assert.equal(validateLesson({ ...l, board: { pieces: [P('a', 'led', 1, 12)] } }).ok, false);
  assert.equal(validateLesson({ ...l, quizzes: [{ ...l.quizzes[0], correctId: 'nope' }] }).ok, false);
});

test('lessonProblems bloqueia título vazio e pergunta sem resposta correta', () => {
  const l = newLesson();
  assert.deepEqual(lessonProblems(l), ['Dê um título à lição.']);
  l.title = 'x';
  const q = newQuiz();
  l.quizzes = [q];
  assert.ok(lessonProblems(l).length > 0);
  q.prompt = 'Qual?';
  q.options[0].text = 'A';
  q.options[1].text = 'B';
  assert.deepEqual(lessonProblems(l), []);
});

test('limites do kit (MFR8): 2 LEDs, 1 de cada resistor, 6 jumpers curtos e 3 de cada jumper longo', () => {
  const fill = (type, n) => Array.from({ length: n }, (_, i) => P(type + i, type, 1 + (i % 9), 2 + (i % 9), i));
  assert.match(placementError(fill('led', 2), P('x', 'led', 5, 6, 11)), /só tem 2/);
  assert.equal(placementError(fill('led', 1), P('x', 'led', 5, 6, 11)), null);
  assert.match(placementError(fill('resistor_220', 1), P('x', 'resistor_220', 5, 6, 11)), /só tem 1/);
  assert.equal(placementError(fill('resistor_220', 1), P('x', 'resistor_1k', 5, 6, 11)), null);
  assert.match(placementError(fill('jumper_curto', 6), P('x', 'jumper_curto', 5, 6, 11)), /só tem 6/);
  assert.match(placementError(fill('jumper_longo', 3), P('x', 'jumper_longo', 5, 7, 11)), /só tem 3/);
  assert.match(placementError(fill('jumper_3', 3), P('x', 'jumper_3', 5, 8, 11)), /só tem 3/);
  assert.equal(placementError(fill('led', 2), P('led0', 'led', 5, 6, 11), 'led0'), null);
  const l = { ...newLesson(), board: { pieces: fill('led', 3) } };
  assert.equal(validateLesson(l).ok, false);
});

test('corrente depende do valor do resistor e antigos "resistor" migram para 470 Ω', () => {
  const mk = (type) =>
    analyze([P('bat', 'bateria', 1, 2), P('r', type, 1, 3), P('led', 'led', 3, 4), P('w', 'jumper_longo', 4, 2)]);
  assert.ok(corrente(mk('resistor_220')) > corrente(mk('resistor_470')));
  assert.ok(corrente(mk('resistor_470')) > corrente(mk('resistor_1k')));
  assert.ok(Math.abs(corrente(mk('resistor_470')) - (3 / 470) * 1000) < 1e-9);
  const l = { ...newLesson(), board: { pieces: [P('a', 'resistor', 1, 2)] } };
  const migrated = validateLesson(l);
  assert.equal(migrated.ok === true ? migrated.lesson.board.pieces[0].type : null, 'resistor_470');
});

test('buzzer sozinho com a bateria fecha o circuito; capacitor bloqueia', () => {
  const buzz = analyze(
    [P('bat', 'bateria', 1, 2), P('z', 'buzzer', 1, 3), P('w', 'jumper_longo', 3, 2, 1)].map((x) => x)
  );
  assert.equal(buzz.code, 'valido');
  assert.equal(buzz.load, 'buzzer');
  assert.ok(corrente(buzz) > 0);
  const cap = analyze([
    P('bat', 'bateria', 1, 2),
    P('c', 'capacitor', 1, 3),
    P('led', 'led', 3, 4),
    P('r', 'resistor_470', 4, 5),
    P('w', 'jumper_longo', 5, 3, 1),
    P('w2', 'jumper_curto', 3, 2, 2),
  ]);
  assert.notEqual(cap.code, 'valido');
  const onlyCap = analyze([P('bat', 'bateria', 1, 2), P('c', 'capacitor', 1, 3), P('w', 'jumper_longo', 3, 2, 1)]);
  assert.equal(onlyCap.code, 'capacitor');
});

test('botão só fecha o caminho enquanto pressionado', () => {
  const pieces = [
    P('bat', 'bateria', 1, 2),
    P('b', 'botao', 1, 3),
    P('led', 'led', 3, 4),
    P('r', 'resistor_470', 4, 5),
    P('w', 'jumper_longo', 5, 3, 1),
    P('w2', 'jumper_curto', 4, 2, 2),
  ];
  const circuit = [
    P('bat', 'bateria', 1, 2),
    P('b', 'botao', 1, 3),
    P('r', 'resistor_470', 3, 4),
    P('led', 'led', 4, 5),
    P('w', 'jumper_longo', 5, 2, 1),
  ];
  assert.equal(analyze(circuit).code, 'valido'); // sem opts: botão conta como pressionado
  assert.equal(analyze(circuit, { pressed: new Set() }).code, 'botao_aberto');
  assert.equal(analyze(circuit, { pressed: new Set(['b']) }).code, 'valido');
  assert.ok(pieces.length > 0);
});

test('potenciômetro: valor muda a corrente e é preservado no JSON', () => {
  const mk = (value) => [
    P('bat', 'bateria', 1, 2),
    { ...P('p', 'potenciometro', 1, 3), value },
    P('led', 'led', 3, 4),
    P('w', 'jumper_longo', 4, 2, 1),
  ];
  assert.ok(corrente(analyze(mk(100))) > corrente(analyze(mk(10000))));
  const l = { ...newLesson(), board: { pieces: [{ ...P('p', 'potenciometro', 1, 2), value: 2200 }] } };
  const parsed = validateLesson(l);
  assert.equal(parsed.ok === true ? parsed.lesson.board.pieces[0].value : null, 2200);
});

test('limites do kit: buzzer 1, capacitor 2, botão 2, potenciômetro 1', () => {
  const fill = (type, n) => Array.from({ length: n }, (_, i) => P(type + i, type, 1 + (i % 9), 2 + (i % 9), i));
  assert.match(placementError(fill('buzzer', 1), P('x', 'buzzer', 5, 6, 11)), /só tem 1/);
  assert.match(placementError(fill('capacitor', 2), P('x', 'capacitor', 5, 6, 11)), /só tem 2/);
  assert.match(placementError(fill('botao', 2), P('x', 'botao', 5, 6, 11)), /só tem 2/);
  assert.match(placementError(fill('potenciometro', 1), P('x', 'potenciometro', 5, 6, 11)), /só tem 1/);
});

test('cores das cápsulas seguem MFR10 e pontos MFR11 distinguem tipos da mesma cor', () => {
  const cor = (t) => DEFS[t].cor;
  assert.equal(cor('bateria'), 'vermelho');
  assert.equal(cor('led'), 'verde');
  assert.equal(cor('buzzer'), 'verde');
  assert.equal(cor('resistor_470'), 'azul');
  assert.equal(cor('capacitor'), 'azul');
  assert.equal(cor('botao'), 'amarelo');
  assert.equal(cor('potenciometro'), 'amarelo');
  assert.equal(cor('jumper_curto'), 'branco');
  assert.equal(cor('jumper_longo'), 'branco');
  // dots only where a blue-class pair needs them; LED/buzzer/botão/potenciômetro carry none
  assert.ok(DEFS.resistor_470.dots >= 1 && DEFS.capacitor.dots <= 4 && DEFS.resistor_470.dots !== DEFS.capacitor.dots);
  for (const t of ['led', 'buzzer', 'botao', 'potenciometro']) assert.equal(DEFS[t].dots, undefined);
});
