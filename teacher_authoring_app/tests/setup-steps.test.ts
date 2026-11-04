import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setupSteps } from '../src/guide/steps.ts';

test('empty account: nothing is done, content comes first', () => {
  const steps = setupSteps({ classes: [], students: [], modules: [] });
  assert.deepEqual(
    steps.map((s) => s.done),
    [false, false, false, false, false]
  );
  assert.equal(steps[0].id, 'content');
});

test('steps complete from what exists; sending is never auto-done', () => {
  const steps = setupSteps({
    classes: [{ id: 1 }],
    students: [{ nfc_code: 'TAG-1' }, { nfc_code: null }],
    modules: [{ class_ids: [1] }],
  });
  assert.deepEqual(
    steps.map((s) => s.done),
    [true, true, true, true, false]
  );
  assert.match(steps[2].doneText, /2 alunos, 1 com tag/);
});

test('students without a tag do not complete the tag step', () => {
  const steps = setupSteps({ classes: [{ id: 1 }], students: [{ nfc_code: null }], modules: [{ class_ids: [] }] });
  assert.equal(steps[2].done, false);
  assert.equal(steps[3].done, false);
});
