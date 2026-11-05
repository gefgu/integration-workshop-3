/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClassDetail } from '../src/lib/api.ts';
import { buildDashboard, formatDuration, type ProgressRow, summarize } from '../src/lib/progress.ts';

const ev = (p: Partial<ProgressRow>): ProgressRow => ({
  student_id: 1,
  lesson_id: null,
  kind: 'step_done',
  score: null,
  duration_s: null,
  at: '2026-11-05T10:00:00Z',
  seq: 1,
  ...p,
});

test('summarize counts finished lessons of the class, best and latest score, and session time', () => {
  const s = summarize(
    [
      ev({ kind: 'lesson_done', lesson_id: 'a', duration_s: 50 }),
      ev({ kind: 'lesson_done', lesson_id: 'other' }),
      ev({ kind: 'challenge_score', lesson_id: 'b', score: 80, at: '2026-11-05T10:01:00Z' }),
      ev({ kind: 'challenge_score', lesson_id: 'b', score: 60, at: '2026-11-05T10:05:00Z' }),
      ev({ kind: 'session', duration_s: 300, at: '2026-11-05T10:06:00Z' }),
    ],
    ['a', 'b']
  );
  assert.equal(s.lessons_done, 1);
  assert.equal(s.progress, 0.5);
  assert.equal(s.best_score, 80);
  assert.equal(s.last_score, 60);
  assert.equal(s.time_spent_s, 300);
  assert.equal(s.last_activity, '2026-11-05T10:06:00Z');
});

test('without sessions, time falls back to finished lessons; empty class gives zeros', () => {
  assert.equal(summarize([ev({ kind: 'lesson_done', lesson_id: 'a', duration_s: 42 })], ['a']).time_spent_s, 42);
  assert.equal(summarize([], []).progress, 0);
});

test('buildDashboard averages progress and best scores over the class', () => {
  const detail: ClassDetail = {
    id: 7,
    name: '7º A',
    description: '',
    lesson_ids: ['a', 'b'],
    module_ids: [],
    students: [
      { id: 1, class_id: 7, name: 'Ana', nickname: 'ana', nfc_code: 'T1', active: true },
      { id: 2, class_id: 7, name: 'Bia', nickname: 'bia', nfc_code: null, active: true },
    ],
  };
  const d = buildDashboard(detail, ['a', 'b'], [
    ev({ student_id: 1, kind: 'lesson_done', lesson_id: 'a' }),
    ev({ student_id: 1, kind: 'lesson_done', lesson_id: 'b' }),
    ev({ student_id: 1, kind: 'challenge_score', score: 90 }),
  ]);
  assert.equal(d.summary.students, 2);
  assert.equal(d.summary.avg_progress, 0.5);
  assert.equal(d.summary.avg_best_score, 90);
  assert.equal(d.students[1].best_score, null);
});

test('formatDuration', () => {
  assert.equal(formatDuration(600), '10 min');
  assert.equal(formatDuration(3900), '1 h 05 min');
});
