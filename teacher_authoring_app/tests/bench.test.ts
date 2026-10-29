import assert from 'node:assert/strict';
import test from 'node:test';
import { serviceUrl } from '../src/bench/benchApi.ts';
import { cameraErrorMessage, gridLines } from '../src/bench/camera.ts';
import { lessonStates, screenAfterLesson } from '../src/bench/screens.ts';
import { newLesson } from '../src/model/lesson.ts';
import { boardBefore, buildPhases, challengeScore } from '../src/player/phases.ts';

const pkg = (ids: string[]) =>
  ({ lessons: ids.map((id) => ({ id, title: id, kind: 'guided' })) }) as unknown as Parameters<typeof lessonStates>[0];

test('lições abrem em ordem e a retomada usa a etapa salva', () => {
  const states = lessonStates(pkg(['a', 'b', 'c']), {
    a: { lesson_id: 'a', step_idx: 3, completed: 1 },
    b: { lesson_id: 'b', step_idx: 2, completed: 0 },
  });
  assert.deepEqual(
    states.map((s) => [s.lesson.id, s.done, s.phase, s.locked]),
    [
      ['a', true, 0, false],
      ['b', false, 2, false],
      ['c', false, 0, true],
    ]
  );
});

test('depois do desafio vem a pontuação; depois da guiada, a tela do aluno', () => {
  const ranking = [{ student_id: 1, nickname: 'ana', score: 90, duration_s: 30 }];
  assert.equal(screenAfterLesson('x', { kind: 'challenge', score: 90, durationS: 30, ranking }).name, 'score');
  assert.equal(screenAfterLesson('x', { kind: 'guided', score: null, durationS: 30, ranking: [] }).name, 'student');
});

test('pontuação do desafio: rápido vale mais, tempo esgotado vale zero', () => {
  assert.equal(challengeScore(0, 120, false), 100);
  assert.equal(challengeScore(60, 120, false), 75);
  assert.equal(challengeScore(500, 120, false), 50);
  assert.equal(challengeScore(10, 120, true), 0);
  assert.equal(challengeScore(300, null, false), 75);
});

test('retomar no meio da lição guiada recoloca as peças dos passos já feitos', () => {
  const lesson = newLesson();
  lesson.board.pieces = [
    { id: 'bat', type: 'bateria', a: 1, b: 2, row: 0 },
    { id: 'led', type: 'led', a: 3, b: 4, row: 1 },
  ];
  lesson.steps = [];
  const phases = buildPhases(lesson);
  const second = phases.findIndex((p) => p.type === 'step' && p.idx === 1);
  assert.deepEqual(
    boardBefore(lesson, second).map((p) => p.id),
    ['bat']
  );
  assert.deepEqual(boardBefore(lesson, 0), []);
});

test('endereço do serviço da bancada', () => {
  assert.equal(serviceUrl({ search: '', hostname: 'pi.local', protocol: 'http:' }), 'http://pi.local:8765');
  assert.equal(
    serviceUrl({ search: '?servico=http://10.0.0.5:9000/', hostname: 'x', protocol: 'http:' }),
    'http://10.0.0.5:9000'
  );
});

test('câmera: mensagens de erro em pt-BR e grade com uma linha por borda de coluna e de banco', () => {
  assert.match(cameraErrorMessage('NotFoundError'), /Nenhuma câmera/);
  assert.match(cameraErrorMessage('NotAllowedError'), /permissão/);
  assert.match(cameraErrorMessage('qualquer'), /Não consegui/);
  const { xs, ys } = gridLines(11, 6);
  assert.equal(xs.length, 12);
  assert.equal(ys.length, 7);
  assert.equal(xs[0], 6);
  assert.equal(Math.round(xs[11]), 94);
});
