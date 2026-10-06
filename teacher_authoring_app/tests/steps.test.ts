import test from 'node:test';
import assert from 'node:assert/strict';
import { autoSplit, cumulativeBoard, effectiveSteps, reconcile, stepProblems, toValidatorLesson, newStep } from '../src/model/steps.ts';
import { newLesson, newQuiz, validateLesson, lessonProblems } from '../src/model/lesson.ts';
import type { Lesson } from '../src/model/types.ts';

const P = (id, type, a, b, row = 0) => ({ id, type, a, b, row });
const board = () => [
  P('j1', 'jumper_curto', 2, 3, 2),
  P('led', 'led', 3, 4, 1),
  P('bat', 'bateria', 1, 2, 0),
  P('j2', 'jumper_longo', 4, 2, 3)
];
const lesson = () => { const l = newLesson(); l.title = 'LED'; l.board.pieces = board(); return l; };

test('autoSplit: bateria primeiro, componentes por coluna, jumpers por último, um por passo', () => {
  const steps = autoSplit(board());
  assert.deepEqual(steps.map(s => s.pieceId), ['bat', 'led', 'j1', 'j2']);
  assert.deepEqual(steps.map(s => s.action), ['place_component', 'place_component', 'place_connection', 'place_connection']);
  assert.match(steps[0].text, /bateria/);
  assert.match(steps[2].text, /colunas 2 e 3/);
  assert.equal(new Set(steps.map(s => s.id)).size, 4);
});

test('cumulativeBoard acumula as peças dos passos até o índice', () => {
  const l = lesson();
  l.steps = autoSplit(l.board.pieces);
  assert.deepEqual(cumulativeBoard(l, 1).map(p => p.id), ['bat', 'led']);
  assert.equal(cumulativeBoard(l, 3).length, 4);
});

test('effectiveSteps: lição antiga sem passos divide a bancada na hora; desafio não tem passos', () => {
  const l = lesson();
  assert.equal(effectiveSteps(l).length, 4);
  assert.deepEqual(effectiveSteps({ ...l, kind: 'challenge' }), []);
});

test('stepProblems: cobertura, ação e pergunta do passo de interação', () => {
  const l = lesson();
  assert.deepEqual(stepProblems(l), []);              // sem passos = ok (usa divisão automática)
  l.steps = autoSplit(l.board.pieces);
  assert.deepEqual(stepProblems(l), []);
  l.steps.pop();
  assert.match(stepProblems(l).join(' '), /1 peça\(s\)/);
  l.steps[0].action = 'place_connection';
  assert.match(stepProblems(l).join(' '), /Passo 1: a ação/);
  l.steps = [...autoSplit(l.board.pieces), newStep({ action: 'interact' })];
  assert.match(stepProblems(l).join(' '), /Passo 5: escolha uma pergunta/);
  const q = newQuiz('step');
  l.quizzes = [q];
  l.steps[4].quizId = q.id;
  assert.deepEqual(stepProblems(l), []);
});

test('stepProblems: tempo limite só em desafio', () => {
  const l = lesson();
  l.timeLimitS = 60;
  assert.match(stepProblems(l).join(' '), /só vale para desafios/);
  l.kind = 'challenge';
  assert.deepEqual(stepProblems(l), []);
  l.timeLimitS = 0;
  assert.match(stepProblems(l).join(' '), /maior que zero/);
});

test('reconcile aponta peças sem passo e passos sem peça', () => {
  const l = lesson();
  l.steps = autoSplit(l.board.pieces);
  l.board.pieces = l.board.pieces.filter(p => p.id !== 'led').concat(P('r', 'resistor_470', 5, 6, 4));
  const r = reconcile(l);
  assert.deepEqual(r.unassigned.map(p => p.id), ['r']);
  assert.deepEqual(r.dangling.map(s => s.pieceId), ['led']);
});

test('toValidatorLesson (guiada): um passo por peça, opções e sobrescritas no formato do validador', () => {
  const l = lesson();
  l.steps = autoSplit(l.board.pieces);
  l.steps[1].options.matchValues = true;
  l.steps[1].overrides = { reversed_polarity: { led: 'Vire o LED!' } };
  const v = toValidatorLesson(l);
  assert.equal(v.kind, 'guided');
  assert.equal(v.steps.length, 4);
  assert.deepEqual(v.steps[0].add, [P('bat', 'bateria', 1, 2, 0)]);
  assert.equal(v.steps[1].options.match_values, true);
  assert.deepEqual(v.steps[1].overrides, { reversed_polarity: { led: 'Vire o LED!' } });
  assert.equal(v.steps[0].text, undefined);
});

test('toValidatorLesson: interact usa o correctId da pergunta; desafio vira passo final com tempo', () => {
  const l = lesson();
  const q = newQuiz('step');
  l.quizzes = [q];
  l.steps = [...autoSplit(l.board.pieces), newStep({ action: 'interact', quizId: q.id })];
  assert.deepEqual(toValidatorLesson(l).steps[4].interact, { quiz_correct_id: q.correctId });
  const c: Lesson = { ...lesson(), kind: 'challenge', timeLimitS: 90 };
  const v = toValidatorLesson(c);
  assert.equal(v.steps.length, 1);
  assert.equal(v.steps[0].pieces.length, 4);
  assert.equal(v.time_limit_s, 90);
});

test('validateLesson: v1 migra para v2 e v2 preserva passos', () => {
  const v1 = { version: 1, id: 'l1', title: 'Antiga', instruction: '', kind: 'guided', board: { pieces: board() }, quizzes: [], updatedAt: 'x' };
  const m = validateLesson(JSON.parse(JSON.stringify(v1)));
  assert.equal(m.ok, true);
  assert.equal(m.lesson.version, 2);
  assert.deepEqual(m.lesson.steps, []);
  assert.equal(m.lesson.timeLimitS, null);

  const l = lesson();
  l.steps = autoSplit(l.board.pieces);
  l.steps[0].overrides = { reversed_polarity: { bateria: 'Inverta!' }, bogus: { led: 'x' } };
  const round = validateLesson(JSON.parse(JSON.stringify(l)));
  assert.equal(round.ok, true);
  assert.equal(round.lesson.steps.length, 4);
  assert.deepEqual(round.lesson.steps[0].overrides, { reversed_polarity: { bateria: 'Inverta!' } });
  assert.equal(validateLesson({ ...JSON.parse(JSON.stringify(l)), steps: 'x' }).ok, false);
  assert.equal(validateLesson({ ...JSON.parse(JSON.stringify(l)), version: 3 }).ok, false);
});

test('lessonProblems inclui os problemas de passos', () => {
  const l = lesson();
  l.steps = autoSplit(l.board.pieces).slice(1);
  assert.ok(lessonProblems(l).some(p => /não têm passo/.test(p)));
});

test('overrideRows/rowsToOverrides são inversas', async () => {
  const { overrideRows, rowsToOverrides } = await import('../src/model/steps.ts');
  const ov = { reversed_polarity: { led: 'Vire!', '*': 'Gire.' }, missing_connection: { '*': 'Falta fio.' } };
  assert.deepEqual(rowsToOverrides(overrideRows(ov)), ov);
  assert.deepEqual(overrideRows({}), []);
});
