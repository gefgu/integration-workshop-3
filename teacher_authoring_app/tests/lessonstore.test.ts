import assert from 'node:assert/strict';
import test from 'node:test';
import { newLesson, newQuiz } from '../src/model/lesson.ts';
import { duplicateLesson } from '../src/storage/lessonStore.ts';

test('duplicar uma lição do currículo gera uma cópia do professor, com perguntas novas', () => {
  const original = newLesson();
  original.tags = ['currículo', 'exemplo', 'desafio'];
  const q = newQuiz('step');
  original.quizzes = [q];
  original.steps = [{ id: 's1', action: 'interact', pieceId: null, quizId: q.id, text: '', options: { matchValues: false, strictPositions: false }, overrides: {} }];
  const copy = duplicateLesson(original);
  assert.deepEqual(copy.tags, ['desafio']);
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.quizzes[0].id, q.id);
  assert.equal(copy.steps[0].quizId, copy.quizzes[0].id);
  assert.equal(original.quizzes[0].id, q.id, 'o original não muda');
  assert.deepEqual(original.tags, ['currículo', 'exemplo', 'desafio']);
});
