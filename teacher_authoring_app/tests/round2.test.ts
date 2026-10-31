import assert from 'node:assert/strict';
import test from 'node:test';
import { curriculumLessons } from '../src/curriculum/lessons.ts';
import { validateLesson } from '../src/model/lesson.ts';
import { diagnose } from '../src/engine/diagnose.ts';

const lessons = curriculumLessons();
test('predictions accept every option and survive export/import', () => {
  for (const suffix of ['02-guiada', '04-guiada', '05-guiada', '07-guiada', '06-desafio']) {
    const lesson = lessons.find((l) => l.id.endsWith(suffix));
    const prediction = lesson.quizzes.find((q) => /q-prev|q-pred/.test(q.id));
    assert.equal(prediction.prediction, true, suffix);
    const imported = validateLesson(JSON.parse(JSON.stringify(lesson)));
    assert.ok(imported.ok);
    assert.equal(imported.lesson.quizzes.find((q) => q.id === prediction.id).prediction, true);
  }
});
test('N-14: alarm reports separate simulated branch currents', () => {
  const lesson = lessons.find((l) => l.id.endsWith('10-guiada'));
  const diag = diagnose(lesson.board.pieces);
  assert.ok(Math.abs(diag.currents.led - 3000 / 470) < 0.01);
  assert.ok(Math.abs(diag.currents.buzzer - 5000 / 470) < 0.01);
});

test('S-04/T2-09: randomized initial board is not a miss; hints escalate', async () => {
  const { challengeHint } = await import('../src/player/hints.ts');
  const { startPieces } = await import('../src/model/steps.ts');
  for (const suffix of ['02-desafio', '04-desafio']) {
    const lesson = lessons.find((l) => l.id.endsWith(suffix));
    const pieces = startPieces(lesson, () => 0);
    assert.match(challengeHint(lesson, pieces, 1, 'dica'), /Ainda não/);
    assert.equal(challengeHint(lesson, pieces, 2, 'dica'), 'dica');
    assert.notEqual(challengeHint(lesson, pieces, 3, 'dica'), challengeHint(lesson, pieces, 4, 'dica'));
  }
});

test('N-10: potentiometer instructions accept the discrete control observation', () => {
  const lesson = lessons.find((l) => l.id.endsWith('06-guiada'));
  const quiz = lesson.quizzes.find((q) => q.id.endsWith('q-gradual'));
  assert.match(quiz.options.find((o) => o.id === quiz.correctId).text, /−\/\+/);
  assert.match(quiz.options.find((o) => o.id === quiz.correctId).feedback, /sete valores/);
  for (const suffix of ['06-guiada', '08-potenciometro']) {
    const source = lessons.find((l) => l.id.endsWith(suffix));
    const result = validateLesson(JSON.parse(JSON.stringify(source)));
    assert.ok(result.ok);
    assert.ok(result.lesson.steps.some((s) => s.experiment?.slider));
  }
});

test('lesson pickers use curriculum teaching order and do not double kind on copies', async () => {
  const { orderLessons, lessonLabel } = await import('../src/model/library.ts');
  const ordered = orderLessons([...lessons].reverse());
  assert.equal(ordered[0].id, 'curriculo-01-guiada');
  assert.equal(ordered[1].id, 'curriculo-01-desafio');
  const lesson = lessons.find((l) => l.id.endsWith('03-desafio'));
  assert.equal(lessonLabel({ ...lesson, title: `${lesson.title} (cópia)` }), `${lesson.title} (cópia)`);
});

test('v4 client steps keep validator indexes one-to-one', async () => {
  const { toValidatorLesson } = await import('../src/model/steps.ts');
  for (const lesson of lessons.filter((l) => l.kind === 'guided')) {
    const validator = toValidatorLesson(lesson);
    assert.equal(validator.steps.length, lesson.steps.length);
    lesson.steps.forEach((step, i) => {
      if (['explain', 'experiment'].includes(step.action)) assert.equal(validator.steps[i].action, 'interact');
    });
  }
});
